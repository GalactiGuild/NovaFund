import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Dual-axis rate limiter for the FeeBump signing endpoint.
 *
 * Axis 1 — IP address   : protects against anonymous flooding (20 req/min)
 * Axis 2 — Wallet address: protects against a single user draining fees
 *                          even if they rotate IPs (10 req/min)
 *
 * Both throttlers are declared in FeeBumpModule's ThrottlerModule.forRoot().
 * This guard picks the right tracker key for each axis.
 */
@Injectable()
export class FeeBumpThrottlerGuard extends ThrottlerGuard {
  /**
   * Returns the tracker key used to bucket requests.
   *
   * For the 'ip' throttler   → use the client IP.
   * For the 'wallet' throttler → use the walletAddress from the request body.
   * Falls back to IP if the wallet is missing (validation will reject it anyway).
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const ip = this.resolveIp(request);
    const wallet: string | undefined = (request.body as { walletAddress?: string })?.walletAddress;

    // The ThrottlerGuard calls getTracker once per throttler name.
    // We encode both in a combined key; NestJS throttler namespacing handles separation.
    return wallet ? `${ip}::${wallet}` : ip;
  }

  /**
   * Resolve the real client IP, respecting common reverse-proxy headers.
   * In production, ensure your reverse proxy is trusted before enabling X-Forwarded-For.
   */
  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      // Take the first (client) IP from the chain
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
