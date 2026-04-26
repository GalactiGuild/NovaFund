import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PathfinderService, PaymentPath, RouteAnalysis } from '../stellar/pathfinder.service';
import { RedisService } from '../redis/redis.service';
import { LeaderboardService } from '../reputation/leaderboard.service';
import {
  InvestmentIntentDto,
  CreateInvestmentIntentInputDto,
  UpdateInvestmentIntentInputDto,
  SwapRouteAnalysisDto,
  SwapRouteDto,
  InvestmentIntentStatus,
} from './dto/investment-intent.dto';

@Injectable()
export class InvestmentIntentService {
  private readonly logger = new Logger(InvestmentIntentService.name);
  private readonly INTENT_VALIDITY_SECONDS = 300; // 5 minutes default

  constructor(
    private readonly prisma: PrismaService,
    private readonly pathfinder: PathfinderService,
    private readonly redis: RedisService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  /**
   * Create a new investment intent with smart order routing
   * 
   * This finds the best swap route from the user's asset to the project's required asset,
   * stores it as a pending intent, and returns the complete package to the user.
   */
  async createInvestmentIntent(
    input: CreateInvestmentIntentInputDto,
  ): Promise<InvestmentIntentDto> {
    this.logger.log(
      `Creating investment intent for project ${input.projectId}, ` +
      `investor ${input.investorId}, amount ${input.investmentAmount}`,
    );

    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${input.projectId} not found`);
    }

    // Check if user already has an active intent for this project
    const existingIntent = await this.prisma.investmentIntent.findFirst({
      where: {
        projectId: input.projectId,
        investorId: input.investorId,
        status: InvestmentIntentStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingIntent) {
      this.logger.warn(
        `Investor ${input.investorId} already has an active intent for project ${input.projectId}`,
      );
      throw new BadRequestException(
        'You already have an active investment intent for this project',
      );
    }

    // Find the best routes using pathfinder
    const routeAnalysis = await this.pathfinder.findBestRoutes(
      input.userAssetCode,
      input.projectAssetCode,
      input.projectAssetIssuer,
      input.investmentAmount.toString(),
      input.userAssetIssuer,
      3,
    );

    // Create the intent record
    const validitySeconds = input.validitySeconds || this.INTENT_VALIDITY_SECONDS;
    const expiresAt = new Date(Date.now() + validitySeconds * 1000);

    const intent = await this.prisma.investmentIntent.create({
      data: {
        projectId: input.projectId,
        investorId: input.investorId,
        investmentAmount: BigInt(Math.floor(input.investmentAmount)),
        userAssetCode: input.userAssetCode,
        userAssetIssuer: input.userAssetIssuer || null,
        projectAssetCode: input.projectAssetCode,
        projectAssetIssuer: input.projectAssetIssuer,
        bestRouteHopCount: routeAnalysis.bestPath.hopCount,
        bestRouteFeePercentage: routeAnalysis.bestPath.estimatedFeePercentage,
        bestRouteConversionRate: routeAnalysis.bestPath.conversionRate,
        routeJson: {
          bestPath: this.serializePaymentPath(routeAnalysis.bestPath),
          alternativePaths: routeAnalysis.alternativePaths.map(p =>
            this.serializePaymentPath(p),
          ),
          recommendation: routeAnalysis.recommendation,
          metrics: routeAnalysis.totalRoutingMetrics,
        },
        status: InvestmentIntentStatus.PENDING,
        expiresAt,
      },
    });

    this.logger.log(
      `Created investment intent ${intent.id} with best fee: ${routeAnalysis.bestPath.estimatedFeePercentage}%`,
    );

    // Cache the intent for quick access
    await this.cacheIntent(intent.id, intent);

    return this.transformIntentToDto(intent, routeAnalysis);
  }

  /**
   * Get a specific investment intent
   */
  async getInvestmentIntent(id: string): Promise<InvestmentIntentDto> {
    // Try cache first
    const cached = await this.redis.get<any>(`investment_intent:${id}`);
    if (cached) {
      this.logger.debug(`Cache hit for intent ${id}`);
      return cached;
    }

    const intent = await this.prisma.investmentIntent.findUnique({
      where: { id },
    });

    if (!intent) {
      throw new NotFoundException(`Investment intent ${id} not found`);
    }

    // Check if intent has expired
    if (intent.status === InvestmentIntentStatus.PENDING && intent.expiresAt < new Date()) {
      await this.expireIntent(intent.id);
      throw new BadRequestException(`Investment intent ${id} has expired`);
    }

    const routeJson = intent.routeJson as any;
    const dto = this.transformIntentToDto(intent, routeJson);

    // Cache for 1 minute
    await this.redis.set(`investment_intent:${id}`, dto, 60);

    return dto;
  }

  /**
   * List investment intents for a project or investor
   */
  async listInvestmentIntents(filters: {
    projectId?: string;
    investorId?: string;
    status?: InvestmentIntentStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ intents: InvestmentIntentDto[]; total: number }> {
    const where: any = {};

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.investorId) where.investorId = filters.investorId;
    if (filters.status) where.status = filters.status;

    const [intents, total] = await Promise.all([
      this.prisma.investmentIntent.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.investmentIntent.count({ where }),
    ]);

    return {
      intents: intents.map(intent => {
        const routeJson = intent.routeJson as any;
        return this.transformIntentToDto(intent, routeJson);
      }),
      total,
    };
  }

  /**
   * Approve/execute an investment intent
   */
  async approveInvestmentIntent(id: string): Promise<InvestmentIntentDto> {
    const intent = await this.getDbIntent(id);

    if (intent.status !== InvestmentIntentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve intent with status ${intent.status}`,
      );
    }

    if (intent.expiresAt < new Date()) {
      await this.expireIntent(id);
      throw new BadRequestException('Investment intent has expired');
    }

    const updated = await this.prisma.investmentIntent.update({
      where: { id },
      data: {
        status: InvestmentIntentStatus.APPROVED,
        executedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateIntentCache(id);

    // Trigger leaderboard refresh check
    await this.leaderboardService.handleMassiveInvestment(Number(updated.investmentAmount));

    this.logger.log(`Approved investment intent ${id}`);

    const routeJson = updated.routeJson as any;
    return this.transformIntentToDto(updated, routeJson);
  }

  /**
   * Reject an investment intent
   */
  async rejectInvestmentIntent(
    id: string,
    reason?: string,
  ): Promise<InvestmentIntentDto> {
    const intent = await this.getDbIntent(id);

    if (intent.status !== InvestmentIntentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject intent with status ${intent.status}`,
      );
    }

    const updated = await this.prisma.investmentIntent.update({
      where: { id },
      data: {
        status: InvestmentIntentStatus.REJECTED,
        rejectionReason: reason || null,
      },
    });

    // Invalidate cache
    await this.invalidateIntentCache(id);

    this.logger.log(`Rejected investment intent ${id}`);

    const routeJson = updated.routeJson as any;
    return this.transformIntentToDto(updated, routeJson);
  }

  /**
   * Check and mark expired intents as expired
   */
  async expireIntent(id: string): Promise<void> {
    await this.prisma.investmentIntent.updateMany({
      where: {
        id,
        status: InvestmentIntentStatus.PENDING,
      },
      data: {
        status: InvestmentIntentStatus.EXPIRED,
      },
    });

    await this.invalidateIntentCache(id);
  }

  /**
   * Clean up expired intents (can be run as a scheduled task)
   */
  async cleanupExpiredIntents(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.investmentIntent.updateMany({
      where: {
        status: InvestmentIntentStatus.PENDING,
        expiresAt: { lt: now },
      },
      data: {
        status: InvestmentIntentStatus.EXPIRED,
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} expired investment intents`,
    );
    return result.count;
  }

  /**
   * Get routing analysis for comparison
   */
  async getRouteAnalysis(id: string): Promise<{
    bestRoute: SwapRouteDto;
    alternatives: SwapRouteDto[];
    metrics: any;
    recommendation: string;
  }> {
    const intent = await this.getDbIntent(id);
    const routeJson = intent.routeJson as any;

    return {
      bestRoute: this.convertPathToDto(routeJson.bestPath, true),
      alternatives: routeJson.alternativePaths.map((p: any) =>
        this.convertPathToDto(p, false),
      ),
      metrics: routeJson.metrics,
      recommendation: routeJson.recommendation,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  private async getDbIntent(id: string): Promise<any> {
    const intent = await this.prisma.investmentIntent.findUnique({
      where: { id },
    });

    if (!intent) {
      throw new NotFoundException(`Investment intent ${id} not found`);
    }

    return intent;
  }

  private async cacheIntent(id: string, intent: any): Promise<void> {
    await this.redis.set(`investment_intent:${id}`, intent, 300);
  }

  private async invalidateIntentCache(id: string): Promise<void> {
    await this.redis.del(`investment_intent:${id}`);
  }

  private serializePaymentPath(path: PaymentPath): any {
    return {
      steps: path.steps,
      sourceAsset: path.sourceAsset,
      destinationAsset: path.destinationAsset,
      sourceAmount: path.sourceAmount,
      destinationAmount: path.destinationAmount,
      estimatedFeePercentage: path.estimatedFeePercentage,
      estimatedFeeAmount: path.estimatedFeeAmount,
      conversionRate: path.conversionRate,
      hopCount: path.hopCount,
      executableImmediately: path.executableImmediately,
    };
  }

  private convertPathToDto(pathJson: any, isOptimal: boolean): SwapRouteDto {
    return {
      sourceAssetCode: pathJson.sourceAsset.code,
      sourceAssetIssuer: pathJson.sourceAsset.issuer,
      destinationAssetCode: pathJson.destinationAsset.code,
      destinationAssetIssuer: pathJson.destinationAsset.issuer,
      sourceAmount: parseFloat(pathJson.sourceAmount),
      destinationAmount: parseFloat(pathJson.destinationAmount),
      feePercentage: pathJson.estimatedFeePercentage,
      conversionRate: pathJson.conversionRate,
      hopCount: pathJson.hopCount,
      isOptimal,
      recommendation: isOptimal
        ? 'Recommended path with best rates'
        : 'Alternative path available',
      timestamp: new Date(),
    };
  }

  private transformIntentToDto(
    intent: any,
    routeAnalysis: any,
  ): InvestmentIntentDto {
    const routeJson = typeof routeAnalysis === 'object' && 'bestPath' in routeAnalysis
      ? routeAnalysis
      : intent.routeJson as any;

    return {
      id: intent.id,
      projectId: intent.projectId,
      investorId: intent.investorId,
      investmentAmount: Number(intent.investmentAmount),
      userAssetCode: intent.userAssetCode,
      userAssetIssuer: intent.userAssetIssuer,
      projectAssetCode: intent.projectAssetCode,
      projectAssetIssuer: intent.projectAssetIssuer,
      proposedRoute: {
        bestRoute: this.convertPathToDto(routeJson.bestPath, true),
        alternativeRoutes: routeJson.alternativePaths.map((p: any) =>
          this.convertPathToDto(p, false),
        ),
        recommendation: routeJson.recommendation,
        avgFeePercentage: routeJson.metrics.avgFeePercentage,
        bestConversionRate: routeJson.metrics.bestConversionRate,
        worstConversionRate: routeJson.metrics.worstConversionRate,
      },
      status: intent.status as InvestmentIntentStatus,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
      executedAt: intent.executedAt,
    };
  }
}
