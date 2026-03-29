import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FeeBumpService } from './fee-bump.service';
import { SignFeeBumpDto, SignFeeBumpResponseDto } from './sign-fee-bump.dto';
import { FeeBumpThrottlerGuard } from './fee-bump-throttler.guard';

/**
 * REST controller for the FeeBump signing microservice.
 *
 * Endpoints:
 *   POST /fee-bump/sign   — validate + sign a FeeBump transaction
 *   GET  /fee-bump/health — liveness probe (unauthenticated, unthrottled)
 *   GET  /fee-bump/info   — returns fee-payer public key (safe metadata)
 */
@Controller('fee-bump')
@UseGuards(FeeBumpThrottlerGuard)
export class FeeBumpController {
  private readonly logger = new Logger(FeeBumpController.name);

  constructor(private readonly feeBumpService: FeeBumpService) {}

  /**
   * Sign a FeeBump transaction.
   *
   * The client submits the inner transaction XDR (already signed by the user),
   * their wallet address, and the operation type. This endpoint wraps it in a
   * FeeBump envelope signed by the fee-payer and returns the final XDR.
   *
   * Rate limits: 20/min per IP, 10/min per wallet (from ThrottlerModule config).
   */
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  // Apply tighter limits specifically to this endpoint
  @Throttle({
    ip: { ttl: 60_000, limit: 20 },
    wallet: { ttl: 60_000, limit: 10 },
  })
  async sign(@Body() dto: SignFeeBumpDto, @Req() req: Request): Promise<SignFeeBumpResponseDto> {
    const ipAddress = this.resolveIp(req);
    this.logger.debug(
      `Sign request | op=${dto.operationType} wallet=${dto.walletAddress} ip=${ipAddress}`,
    );
    return this.feeBumpService.sign(dto, ipAddress);
  }

  /**
   * Health check — skips rate limiting.
   * Returns 200 OK when the service is up.
   */
  @Get('health')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Returns public metadata about this signing service.
   * Exposes the fee-payer public key so clients can verify the signer.
   */
  @Get('info')
  @SkipThrottle()
  info(): { feePayerPublicKey: string; supportedOperations: string[] } {
    return {
      feePayerPublicKey: this.feeBumpService.feePayerPublicKey,
      supportedOperations: ['invest', 'refund', 'create_project', 'release_milestone'],
    };
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
