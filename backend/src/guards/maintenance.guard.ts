import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const MAINTENANCE_KEY = 'system:maintenance_mode';
export const MAINTENANCE_MESSAGE_KEY = 'system:maintenance_message';
export const DEFAULT_MAINTENANCE_MESSAGE =
  'The platform is currently undergoing scheduled maintenance. Please try again later.';

/**
 * MaintenanceGuard — intercepts all non-admin requests when maintenance mode is active.
 *
 * Enable:  redisService.set(MAINTENANCE_KEY, 'true')
 * Disable: redisService.del(MAINTENANCE_KEY)
 * Custom message: redisService.set(MAINTENANCE_MESSAGE_KEY, 'Back at 14:00 UTC')
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isActive = await this.redis.get<string>(MAINTENANCE_KEY);
    if (isActive !== 'true') return true;

    // Admins bypass maintenance mode
    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    if (user && (user.isAdmin === true || user.role === 'admin')) return true;

    const message =
      (await this.redis.get<string>(MAINTENANCE_MESSAGE_KEY)) ?? DEFAULT_MAINTENANCE_MESSAGE;

    throw new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message,
      maintenance: true,
    });
  }
}
