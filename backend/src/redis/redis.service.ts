import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // Note: This implementation depends on the underlying cache store
      // For Redis, we can use the Redis client directly if available
      // Otherwise, we'll need to track keys differently
      const cache = this.cacheManager as any;
      if (cache.store && cache.store.client) {
        const keys = await cache.store.client.keys(pattern);
        if (keys.length > 0) {
          await cache.store.client.del(...keys);
          this.logger.debug(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
        }
      } else {
        this.logger.warn('Pattern-based deletion not available with current cache store');
      }
    } catch (error) {
      this.logger.error(`Failed to delete cache keys matching pattern ${pattern}:`, error);
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      this.logger.error(`Failed to check if cache key ${key} exists:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      const cache = this.cacheManager as any;
      if (cache.store && cache.store.reset) {
        await cache.store.reset();
      } else if (cache.reset) {
        await cache.reset();
      } else {
        // Fallback: try to clear by accessing the underlying Redis client
        await this.delPattern('*');
      }
      this.logger.log('Cache reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset cache:', error);
    }
  }

  /**
   * Generate cache key for project
   */
  static getProjectKey(projectId: string): string {
    return `project:${projectId}`;
  }

  /**
   * Generate cache key for project list
   */
  static getProjectListKey(filters?: any): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `projects:list:${Buffer.from(filterStr).toString('base64')}`;
  }

  /**
   * Generate cache key for project contributions
   */
  static getProjectContributionsKey(projectId: string): string {
    return `project:${projectId}:contributions`;
  }

  /**
   * Generate cache key for project milestones
   */
  static getProjectMilestonesKey(projectId: string): string {
    return `project:${projectId}:milestones`;
  }

  /**
   * Generate cache key for user projects
   */
  static getUserProjectsKey(userId: string): string {
    return `user:${userId}:projects`;
  }

  /**
   * Invalidate all project-related cache entries
   */
  async invalidateProjectCache(projectId: string): Promise<void> {
    const patterns = [
      `project:${projectId}*`,
      `projects:list*`,
    ];

    await Promise.all(patterns.map(pattern => this.delPattern(pattern)));
    this.logger.debug(`Invalidated cache for project ${projectId}`);
  }

  /**
   * Invalidate user-related cache entries
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `user:${userId}*`,
      `projects:list*`,
    ];

    await Promise.all(patterns.map(pattern => this.delPattern(pattern)));
    this.logger.debug(`Invalidated cache for user ${userId}`);
  }
}
