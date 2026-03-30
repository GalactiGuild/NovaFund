import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return { req: ctx.getContext().req as Request, res: ctx.getContext().res };
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ??
      request.ip ??
      'unknown';
    const userId: string | undefined = (request as any).user?.id;
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  // Resolvers with @Throttle({ aggregate }) get both tiers; others only get 'default'
  protected async getThrottlers(context: ExecutionContext): Promise<ThrottlerOptions[]> {
    const all = await super.getThrottlers(context);
    const hasExplicit = Reflect.getMetadata('THROTTLER:THROTTLERS', context.getHandler());
    return hasExplicit ? all : all.filter((t) => t.name === 'default');
  }

  protected throwThrottlingException(): never {
    const { HttpException, HttpStatus } = require('@nestjs/common');
    throw new HttpException(
      {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry after the indicated time.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
