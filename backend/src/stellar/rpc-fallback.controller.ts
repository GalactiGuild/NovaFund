import { Controller, Get, Post, HttpException, HttpStatus, Param } from '@nestjs/common';
import { RpcFallbackService } from './rpc-fallback.service';

@Controller('rpc')
export class RpcFallbackController {
  constructor(private readonly rpcFallbackService: RpcFallbackService) {}

  @Get('status')
  getRpcStatus() {
    const status = this.rpcFallbackService.getRpcStatus();
    const circuitBreakerState = this.rpcFallbackService.getCircuitBreakerState();
    
    return {
      circuitBreaker: circuitBreakerState,
      nodes: status.map(node => ({
        name: node.name,
        url: node.url,
        priority: node.priority,
        isHealthy: node.isHealthy,
        consecutiveFailures: node.consecutiveFailures,
        lastHealthCheck: node.lastHealthCheck,
        responseTime: node.responseTime,
      })),
      summary: {
        totalNodes: status.length,
        healthyNodes: status.filter(node => node.isHealthy).length,
        unhealthyNodes: status.filter(node => !node.isHealthy).length,
      },
    };
  }

  @Post('switch/:nodeName')
  async forceSwitchNode(@Param('nodeName') nodeName: string) {
    try {
      await this.rpcFallbackService.forceSwitchToNode(nodeName);
      return { message: `Successfully switched to RPC node: ${nodeName}` };
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('circuit-breaker/reset')
  resetCircuitBreaker() {
    this.rpcFallbackService.resetCircuitBreaker();
    return { message: 'Circuit breaker reset to CLOSED state' };
  }

  @Get('health')
  getHealthCheck() {
    const status = this.rpcFallbackService.getRpcStatus();
    const circuitBreakerState = this.rpcFallbackService.getCircuitBreakerState();
    const healthyNodes = status.filter(node => node.isHealthy).length;
    
    const isHealthy = healthyNodes > 0 && circuitBreakerState !== 'OPEN';
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      circuitBreaker: circuitBreakerState,
      healthyNodes,
      totalNodes: status.length,
    };
  }
}
