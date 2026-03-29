# Redis Caching Implementation

This document describes the Redis caching layer implemented for the NovaFund backend to improve performance during high traffic periods, particularly during project launches.

## Overview

The Redis caching implementation provides:
- **Automatic caching** for frequently accessed project queries
- **Cache invalidation** when project data is updated via blockchain events
- **Configurable TTL** (Time To Live) for different types of cached data
- **Pattern-based cache clearing** for efficient bulk invalidation

## Architecture

### Components

1. **RedisModule** (`src/redis/redis.module.ts`)
   - Global module providing Redis configuration
   - Uses `cache-manager-ioredis-yet` for Redis integration
   - Configurable via environment variables

2. **RedisService** (`src/redis/redis.service.ts`)
   - Wrapper service for cache operations
   - Provides utility methods for cache key generation
   - Handles pattern-based cache invalidation

3. **ProjectService** (`src/project/project.service.ts`)
   - Enhanced with caching for all project-related queries
   - Cache-first strategy: checks cache before database
   - Automatic cache population on cache misses

4. **Event Handlers** (`src/indexer/services/event-handler.service.ts`)
   - Enhanced to invalidate cache on blockchain events
   - Ensures cache consistency with on-chain data

## Cached Endpoints

### GraphQL Queries
- `project(id: String)` - Individual project details
- `projectByContractId(contractId: String)` - Project by contract ID
- `projects(filters)` - Project list with pagination and filters
- `activeProjects` - List of active projects
- `projectsByCreator(creatorId: String)` - Projects by specific creator

### REST Endpoints
- `GET /projects/:id` - Individual project details
- `GET /projects/contract/:contractId` - Project by contract ID
- `GET /projects` - Project list with pagination and filters
- `GET /projects/active/list` - List of active projects
- `GET /projects/creator/:creatorId` - Projects by specific creator

## Cache TTL Configuration

| Cache Type | TTL (seconds) | Description |
|------------|---------------|-------------|
| Individual Project | 300 | 5 minutes - Project details |
| Project List | 180 | 3 minutes - Project listings |
| Active Projects | 120 | 2 minutes - Active projects list |
| User Projects | 180 | 3 minutes - User's projects |

## Cache Invalidation

Cache is automatically invalidated when:

1. **Project Created** (`PROJECT_CREATED` event)
   - Invalidates project lists and user project cache

2. **Contribution Made** (`CONTRIBUTION_MADE` event)
   - Invalidates the specific project cache
   - Invalidates contributor's project cache

3. **Milestone Events** (`MILESTONE_APPROVED`, `MILESTONE_REJECTED`)
   - Invalidates the specific project cache

4. **Project Status Changes** (`PROJECT_COMPLETED`, `PROJECT_FAILED`)
   - Invalidates the specific project cache
   - Invalidates project listings

## Environment Configuration

Add the following to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_DEFAULT_TTL=300
REDIS_MAX_KEYS=1000
```

## Cache Key Patterns

- `novafund:project:{projectId}` - Individual project
- `novafund:project:contract:{contractId}` - Project by contract ID
- `novafund:projects:list:{base64(filters)}` - Project listings
- `novafund:projects:active:{limit}` - Active projects
- `novafund:user:{userId}:projects:{limit}` - User's projects

## Performance Benefits

1. **Reduced Database Load**: Frequently accessed project data served from Redis
2. **Faster Response Times**: Cache hits return in milliseconds vs database queries
3. **Scalability**: Better handling of concurrent requests during project launches
4. **Automatic Consistency**: Cache invalidated on blockchain events ensures data freshness

## Monitoring and Debugging

The RedisService includes comprehensive logging:
- Cache hits/misses are logged at debug level
- Cache invalidation events are logged
- Error handling with fallback to database queries

## Testing

Unit tests are provided in `src/project/project.service.spec.ts`:
- Cache hit scenarios
- Cache miss scenarios with database fallback
- Cache invalidation testing
- Error handling

## Best Practices

1. **Cache Warming**: Consider warming cache for popular projects during launch
2. **Monitoring**: Monitor Redis memory usage and hit rates
3. **Graceful Degradation**: System continues to work even if Redis is unavailable
4. **TTL Optimization**: Adjust TTL values based on data volatility and usage patterns

## Future Enhancements

1. **Multi-level Caching**: Add in-memory cache for ultra-fast access
2. **Cache Analytics**: Track cache performance metrics
3. **Smart Invalidation**: More granular cache invalidation based on specific data changes
4. **Cache Compression**: Compress large cached objects to save memory
