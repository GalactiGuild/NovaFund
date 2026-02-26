/**
 * Handler for MILESTONE_REJECTED events
 */
class MilestoneRejectedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_REJECTED;
  private readonly logger = new Logger(MilestoneRejectedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as any;
    return !!(data.projectId !== undefined && data.milestoneId !== undefined);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as any;

    this.logger.log(
      `Processing MILESTONE_REJECTED: Milestone ${data.milestoneId} for project ${data.projectId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for milestone rejection`);
      return;
    }

    // Update milestone status
    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        status: 'REJECTED',
      },
    });

    // Notify all contributors of this project
    const contributors = await this.prisma.contribution.findMany({
      where: { projectId: project.id },
      select: { investorId: true },
      distinct: ['investorId'],
    });

    for (const contribution of contributors) {
      try {
        await this.notificationService.notify(
          contribution.investorId,
          'MILESTONE',
          'Project Milestone Failed',
          `A project you back (${project.title}) has a failed milestone!`,
          { projectId: project.id, milestoneId: data.milestoneId }
        );
      } catch (e) {
        this.logger.error(`Failed to notify investor ${contribution.investorId} of milestone: ${e.message}`);
      }
    }

    // Update trust score for the creator
    if (project.creatorId) {
      await this.reputationService.updateTrustScore(project.creatorId);
      this.logger.log(`Updated trust score for creator ${project.creatorId}`);
    }
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  ParsedContractEvent,
  ContractEventType,
  ProjectCreatedEvent,
  ContributionMadeEvent,
  MilestoneApprovedEvent,
  FundsReleasedEvent,
  ProjectStatusEvent,
} from '../types/event-types';
import { IEventHandler, IEventHandlerRegistry } from '../interfaces/event-handler.interface';
import { NotificationService } from '../../notification/services/notification.service';
import { ReputationService } from '../../reputation/reputation.service';

/**
 * Handler for PROJECT_CREATED events
 */
class ProjectCreatedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_CREATED;
  private readonly logger = new Logger(ProjectCreatedHandler.name);

  constructor(private readonly prisma: PrismaService) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectCreatedEvent;
    return !!(
      data.projectId !== undefined &&
      data.creator &&
      data.fundingGoal &&
      data.deadline &&
      data.token
    );
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectCreatedEvent;

    this.logger.log(`Processing PROJECT_CREATED: Project ${data.projectId} by ${data.creator}`);

    // Find or create user
    const user = await this.prisma.user.upsert({
      where: { walletAddress: data.creator },
      update: {},
      create: {
        walletAddress: data.creator,
        reputationScore: 0,
      },
    });

    // Create project
    await this.prisma.project.upsert({
      where: { contractId: data.projectId.toString() },
      update: {
        title: `Project ${data.projectId}`, // Will be updated with metadata
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
      create: {
        contractId: data.projectId.toString(),
        creatorId: user.id,
        title: `Project ${data.projectId}`,
        category: 'uncategorized',
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Created/updated project ${data.projectId}`);
  }
}

/**
 * Handler for CONTRIBUTION_MADE events
 */
class ContributionMadeHandler implements IEventHandler {
  readonly eventType = ContractEventType.CONTRIBUTION_MADE;
  private readonly logger = new Logger(ContributionMadeHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ContributionMadeEvent;
    return !!(data.projectId !== undefined && data.contributor && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ContributionMadeEvent;

    this.logger.log(
      `Processing CONTRIBUTION_MADE: ${data.amount} to project ${data.projectId} from ${data.contributor}`,
    );

    // Find or create user
    const user = await this.prisma.user.upsert({
      where: { walletAddress: data.contributor },
      update: {},
      create: {
        walletAddress: data.contributor,
        reputationScore: 0,
      },
    });

    // Find project
    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for contribution`);
      return;
    }

    // Create contribution
    await this.prisma.contribution.upsert({
      where: { transactionHash: event.transactionHash },
      update: {},
      create: {
        transactionHash: event.transactionHash,
        investorId: user.id,
        projectId: project.id,
        amount: BigInt(data.amount),
        timestamp: event.ledgerClosedAt,
      },
    });

    // Update project current funds
    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        currentFunds: BigInt(data.totalRaised),
      },
    });

    // Dispatch notification
    try {
      await this.notificationService.notify(
        user.id,
        'CONTRIBUTION',
        'Contribution Successful!',
        `Your contribution of ${data.amount} to project ${project.title} was successful.`,
        { projectId: project.id, amount: data.amount }
      );
    } catch (e) {
      this.logger.error(`Failed to send contribution notification to user ${user.id}: ${e.message}`);
    }

    this.logger.log(`Recorded contribution of ${data.amount} for project ${data.projectId}`);
  }
}

/**
 * Handler for MILESTONE_APPROVED events
 */
class MilestoneApprovedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_APPROVED;
  private readonly logger = new Logger(MilestoneApprovedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
  ) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as MilestoneApprovedEvent;
    return !!(data.projectId !== undefined && data.milestoneId !== undefined);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as MilestoneApprovedEvent;

    this.logger.log(
      `Processing MILESTONE_APPROVED: Milestone ${data.milestoneId} for project ${data.projectId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for milestone approval`);
      return;
    }

    // Update milestone status
    // Note: milestoneId in contract maps to contract-specific ID,
    // we may need to query by project + milestone index
    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
        // This assumes we store contract milestone ID somewhere or use order
        // You may need to adjust based on your actual data model
      },
      data: {
        status: 'APPROVED',
      },
    });

    // Notify all contributors of this project
    const contributors = await this.prisma.contribution.findMany({
      where: { projectId: project.id },
      select: { investorId: true },
      distinct: ['investorId'],
    });

    for (const contribution of contributors) {
      try {
        await this.notificationService.notify(
          contribution.investorId,
          'MILESTONE',
          'Project Milestone Reached!',
          `A project you back (${project.title}) has reached a new milestone!`,
          { projectId: project.id, milestoneId: data.milestoneId }
        );
      } catch (e) {
        this.logger.error(`Failed to notify investor ${contribution.investorId} of milestone: ${e.message}`);
      }
    }

    this.logger.log(`Approved milestone for project ${data.projectId}`);

    // Update trust score for the creator
    if (project.creatorId) {
      await this.reputationService.updateTrustScore(project.creatorId);
      this.logger.log(`Updated trust score for creator ${project.creatorId}`);
    }
  }
}

/**
 * Handler for FUNDS_RELEASED events
 */
class FundsReleasedHandler implements IEventHandler {
  readonly eventType = ContractEventType.FUNDS_RELEASED;
  private readonly logger = new Logger(FundsReleasedHandler.name);

  constructor(private readonly prisma: PrismaService) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as FundsReleasedEvent;
    return !!(data.projectId !== undefined && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as FundsReleasedEvent;

    this.logger.log(
      `Processing FUNDS_RELEASED: ${data.amount} for project ${data.projectId}, milestone ${data.milestoneId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for funds release`);
      return;
    }

    // Update milestone to funded status
    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        status: 'FUNDED',
        completionDate: event.ledgerClosedAt,
      },
    });

    this.logger.log(`Released funds for project ${data.projectId}`);
  }
}

/**
 * Handler for PROJECT_COMPLETED events
 */
class ProjectCompletedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_COMPLETED;
  private readonly logger = new Logger(ProjectCompletedHandler.name);

  constructor(private readonly prisma: PrismaService) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectStatusEvent;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectStatusEvent;

    this.logger.log(`Processing PROJECT_COMPLETED: Project ${data.projectId}`);

    await this.prisma.project.updateMany({
      where: { contractId: data.projectId.toString() },
      data: { status: 'COMPLETED' },
    });

    this.logger.log(`Marked project ${data.projectId} as completed`);
  }
}

/**
 * Handler for PROJECT_FAILED events
 */
class ProjectFailedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_FAILED;
  private readonly logger = new Logger(ProjectFailedHandler.name);

  constructor(private readonly prisma: PrismaService) { }

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectStatusEvent;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectStatusEvent;

    this.logger.log(`Processing PROJECT_FAILED: Project ${data.projectId}`);

    await this.prisma.project.updateMany({
      where: { contractId: data.projectId.toString() },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Marked project ${data.projectId} as failed/cancelled`);
  }
}

/**
 * Service that manages event handlers and routes events to appropriate handlers
 */
@Injectable()
export class EventHandlerService implements IEventHandlerRegistry {
  private readonly logger = new Logger(EventHandlerService.name);
  private readonly handlers = new Map<string, IEventHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    this.registerHandlers();
  }

  /**
   * Register all event handlers
   */
  private registerHandlers(): void {
    this.register(new ProjectCreatedHandler(this.prisma));
    this.register(new ContributionMadeHandler(this.prisma, this.notificationService));
    this.register(new MilestoneApprovedHandler(this.prisma, this.notificationService, this.reputationService));
    this.register(new MilestoneRejectedHandler(this.prisma, this.notificationService, this.reputationService));
    this.register(new FundsReleasedHandler(this.prisma));
    this.register(new ProjectCompletedHandler(this.prisma));
    this.register(new ProjectFailedHandler(this.prisma));

    this.logger.log(`Registered ${this.handlers.size} event handlers`);
  }

  /**
   * Register an event handler
   */
  register(handler: IEventHandler): void {
    this.handlers.set(handler.eventType, handler);
    this.logger.debug(`Registered handler for ${handler.eventType}`);
  }

  /**
   * Get handler for a specific event type
   */
  getHandler(eventType: string): IEventHandler | undefined {
    return this.handlers.get(eventType);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): IEventHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Process a parsed contract event
   * Routes to appropriate handler if available
   */
  async processEvent(event: ParsedContractEvent): Promise<boolean> {
    const handler = this.getHandler(event.eventType);

    if (!handler) {
      this.logger.debug(`No handler registered for event type: ${event.eventType}`);
      return false;
    }

    try {
      // Validate event data
      if (!handler.validate(event)) {
        this.logger.warn(`Event validation failed for ${event.eventType}`);
        return false;
      }

      // Process the event
      await handler.handle(event);
      return true;
    } catch (error) {
      this.logger.error(`Error processing event ${event.eventType}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if an event type is supported
   */
  isSupported(eventType: string): boolean {
    return this.handlers.has(eventType);
  }
}
