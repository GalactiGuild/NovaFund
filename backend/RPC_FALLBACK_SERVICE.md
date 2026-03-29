# Soroban RPC Fallback Service

This document describes the robust RPC connection manager implemented for the NovaFund backend to ensure continuous operation during Stellar infrastructure outages.

## Overview

The RPC Fallback Service provides:
- **Automatic failover** to backup Stellar RPC nodes when primary fails
- **Circuit breaker pattern** to prevent cascading failures
- **Health monitoring** with periodic health checks
- **Round-robin selection** of healthy RPC nodes
- **Comprehensive logging** of RPC switches and failures

## Architecture

### Core Components

1. **RpcFallbackService** (`src/stellar/rpc-fallback.service.ts`)
   - Main service managing RPC connections and failover logic
   - Implements circuit breaker pattern with configurable thresholds
   - Provides health monitoring and automatic recovery

2. **RpcFallbackController** (`src/stellar/rpc-fallback.controller.ts`)
   - REST API endpoints for monitoring and manual intervention
   - Status reporting and circuit breaker management

3. **Circuit Breaker States**
   - **CLOSED**: Normal operation, all requests flow through
   - **OPEN**: Circuit is tripped, no requests allowed
   - **HALF_OPEN**: Testing if service has recovered

## Configuration

### Environment Variables

```env
# Primary Stellar RPC URL
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Backup RPC URLs (comma-separated)
STELLAR_BACKUP_RPC_URLS=https://backup1.example.com,https://backup2.example.com

# Circuit Breaker Configuration
RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
RPC_CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60000
RPC_CIRCUIT_BREAKER_MONITORING_PERIOD=30000

# Health Check Configuration
RPC_HEALTH_CHECK_INTERVAL=30000
RPC_REQUEST_TIMEOUT=10000
```

### Configuration Details

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_RPC_URL` | Primary RPC endpoint | `https://soroban-testnet.stellar.org` |
| `STELLAR_BACKUP_RPC_URLS` | Comma-separated backup URLs | `""` |
| `RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Failures before circuit opens | `5` |
| `RPC_CIRCUIT_BREAKER_RECOVERY_TIMEOUT` | Time before trying recovery (ms) | `60000` |
| `RPC_HEALTH_CHECK_INTERVAL` | Health check frequency (ms) | `30000` |
| `RPC_REQUEST_TIMEOUT` | Request timeout (ms) | `10000` |

## Features

### 1. Automatic Failover

The service automatically switches to backup RPC nodes when:
- Primary node becomes unresponsive
- Circuit breaker threshold is reached
- Health checks detect node failure

**Example:**
```typescript
// Automatic failover with circuit breaker protection
const result = await rpcFallbackService.executeRpcOperation(
  async (server) => await server.getLatestLedger(),
  'getLatestLedger'
);
```

### 2. Circuit Breaker Pattern

Prevents cascading failures by:
- Tracking consecutive failures
- Opening circuit after threshold failures
- Automatic recovery after timeout
- Half-open state for testing recovery

### 3. Health Monitoring

Continuous monitoring includes:
- Periodic health checks on all nodes
- Response time tracking
- Failure counting and node marking
- Automatic node recovery detection

### 4. Round-Robin Selection

When multiple healthy nodes are available:
- Prioritizes by configured priority (primary first)
- Balances load across healthy nodes
- Automatic failover to next healthy node

## API Endpoints

### Monitoring Endpoints

#### `GET /rpc/status`
Returns detailed status of all RPC nodes:
```json
{
  "circuitBreaker": "CLOSED",
  "nodes": [
    {
      "name": "Primary",
      "url": "https://soroban-testnet.stellar.org",
      "priority": 1,
      "isHealthy": true,
      "consecutiveFailures": 0,
      "lastHealthCheck": "2024-03-27T00:00:00.000Z",
      "responseTime": 245
    }
  ],
  "summary": {
    "totalNodes": 3,
    "healthyNodes": 3,
    "unhealthyNodes": 0
  }
}
```

#### `GET /rpc/health`
Simple health check endpoint:
```json
{
  "status": "healthy",
  "circuitBreaker": "CLOSED",
  "healthyNodes": 2,
  "totalNodes": 3
}
```

### Management Endpoints

#### `POST /rpc/switch/:nodeName`
Force switch to specific RPC node:
```bash
curl -X POST http://localhost:3000/rpc/switch/Backup-1
```

#### `POST /rpc/circuit-breaker/reset`
Manually reset circuit breaker:
```bash
curl -X POST http://localhost:3000/rpc/circuit-breaker/reset
```

## Usage in Services

### Indexer Service Integration

The indexer service automatically uses the RPC fallback service:

```typescript
@Injectable()
export class IndexerService {
  constructor(
    private readonly rpcFallbackService: RpcFallbackService,
  ) {}

  private async getLatestLedger(): Promise<number> {
    return await this.rpcFallbackService.executeRpcOperation(
      async (server) => await server.getLatestLedger(),
      'getLatestLedger'
    );
  }
}
```

### Direct Usage

For other services needing RPC access:

```typescript
@Injectable()
export class CustomService {
  constructor(
    private readonly rpcFallbackService: RpcFallbackService,
  ) {}

  async getAccountBalance(accountId: string) {
    return await this.rpcFallbackService.executeRpcOperation(
      async (server) => await server.getAccount(accountId),
      'getAccount'
    );
  }
}
```

## Logging and Monitoring

### Log Levels

- **INFO**: RPC switches, circuit breaker state changes
- **WARN**: Node failures, health check failures
- **ERROR**: Circuit breaker triggered, all nodes failed
- **DEBUG**: Individual RPC operations, health check results

### Monitoring Metrics

Track these metrics for operational health:
- RPC node health status
- Circuit breaker state changes
- Response times per node
- Failures and recovery events
- Switch frequency and patterns

## Best Practices

### 1. Node Configuration
- Use geographically distributed backup nodes
- Configure different RPC providers for redundancy
- Set appropriate timeouts based on network conditions

### 2. Circuit Breaker Settings
- Adjust failure threshold based on expected error rates
- Set recovery timeout to allow service restoration
- Monitor circuit breaker trips for infrastructure issues

### 3. Health Check Intervals
- Balance between detection speed and overhead
- More frequent checks during high-traffic periods
- Consider node-specific health check strategies

### 4. Monitoring and Alerting
- Alert on circuit breaker state changes
- Monitor node health trends
- Track RPC switch patterns
- Set up automated recovery procedures

## Troubleshooting

### Common Issues

1. **Frequent Circuit Breaker Trips**
   - Check RPC node reliability
   - Increase failure threshold
   - Review timeout settings

2. **High Switch Frequency**
   - Investigate node performance issues
   - Check network connectivity
   - Review health check intervals

3. **All Nodes Unhealthy**
   - Verify network connectivity
   - Check RPC service status
   - Review configuration settings

### Debug Commands

```bash
# Check current RPC status
curl http://localhost:3000/rpc/status

# Force switch to backup node
curl -X POST http://localhost:3000/rpc/switch/Backup-1

# Reset circuit breaker
curl -X POST http://localhost:3000/rpc/circuit-breaker/reset
```

## Performance Considerations

### Response Time Impact
- Health checks add minimal overhead
- Circuit breaker prevents cascading failures
- Failover adds ~100-500ms latency

### Resource Usage
- Memory: Minimal (node status tracking)
- Network: Health check traffic (~1KB/node/check)
- CPU: Circuit breaker logic (negligible)

## Future Enhancements

1. **Advanced Load Balancing**: Weighted round-robin based on response times
2. **Predictive Failover**: ML-based failure prediction
3. **Dynamic Configuration**: Runtime configuration updates
4. **Metrics Integration**: Prometheus/Grafana metrics export
5. **Multi-Chain Support**: Support for multiple blockchain networks
