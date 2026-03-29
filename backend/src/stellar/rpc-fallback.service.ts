import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { Interval } from '@nestjs/schedule';

export interface RpcNode {
  url: string;
  name: string;
  priority: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  responseTime?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface RpcFallbackConfig {
  primaryRpcUrl: string;
  backupRpcUrls: string[];
  circuitBreaker: CircuitBreakerConfig;
  healthCheckInterval: number;
  requestTimeout: number;
}

@Injectable()
export class RpcFallbackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RpcFallbackService.name);
  private readonly config: Required<RpcFallbackConfig>;
  private rpcNodes: RpcNode[] = [];
  private currentNodeIndex = 0;
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;
  private totalFailures = 0;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.initializeRpcNodes();
  }

  private loadConfiguration(): Required<RpcFallbackConfig> {
    const primaryRpcUrl = this.configService.get<string>('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org');
    const backupRpcUrls = this.configService.get<string>('STELLAR_BACKUP_RPC_URLS', '')?.split(',') || [];

    return {
      primaryRpcUrl,
      backupRpcUrls: backupRpcUrls.filter(url => url.trim()),
      circuitBreaker: {
        failureThreshold: this.configService.get<number>('RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD', 5),
        recoveryTimeout: this.configService.get<number>('RPC_CIRCUIT_BREAKER_RECOVERY_TIMEOUT', 60000),
        monitoringPeriod: this.configService.get<number>('RPC_CIRCUIT_BREAKER_MONITORING_PERIOD', 30000),
      },
      healthCheckInterval: this.configService.get<number>('RPC_HEALTH_CHECK_INTERVAL', 30000),
      requestTimeout: this.configService.get<number>('RPC_REQUEST_TIMEOUT', 10000),
    };
  }

  private initializeRpcNodes(): void {
    this.rpcNodes = [
      {
        url: this.config.primaryRpcUrl,
        name: 'Primary',
        priority: 1,
        isHealthy: true,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
      },
      ...this.config.backupRpcUrls.map((url, index) => ({
        url: url.trim(),
        name: `Backup-${index + 1}`,
        priority: index + 2,
        isHealthy: true,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
      })),
    ];

    this.logger.log(`Initialized ${this.rpcNodes.length} RPC nodes`);
    this.rpcNodes.forEach(node => {
      this.logger.debug(`RPC Node: ${node.name} (${node.url})`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.performInitialHealthCheck();
    this.logger.log('RPC Fallback Service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup if needed
    this.logger.log('RPC Fallback Service destroyed');
  }

  /**
   * Get a healthy RPC server instance with circuit breaker protection
   */
  async getRpcServer(): Promise<SorobanRpc.Server> {
    if (this.circuitBreakerState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.circuitBreaker.recoveryTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        this.logger.warn('Circuit breaker transitioning to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - RPC service temporarily unavailable');
      }
    }

    const healthyNode = this.selectHealthyNode();
    if (!healthyNode) {
      this.triggerCircuitBreaker();
      throw new Error('No healthy RPC nodes available');
    }

    try {
      const server = new SorobanRpc.Server(healthyNode.url, {
        allowHttp: healthyNode.url.startsWith('http://'),
      });

      // Test the connection
      await this.testRpcConnection(server);
      
      // Reset failure count on successful connection
      healthyNode.consecutiveFailures = 0;
      healthyNode.isHealthy = true;
      
      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED';
        this.logger.log('Circuit breaker transitioning to CLOSED state');
      }

      this.logger.debug(`Using RPC node: ${healthyNode.name} (${healthyNode.url})`);
      return server;
    } catch (error) {
      this.handleNodeFailure(healthyNode, error);
      return this.getRpcServer(); // Recursive call to try next node
    }
  }

  /**
   * Execute RPC operation with automatic retry and fallback
   */
  async executeRpcOperation<T>(
    operation: (server: SorobanRpc.Server) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error;

    for (let attempt = 0; attempt < this.rpcNodes.length; attempt++) {
      try {
        const server = await this.getRpcServer();
        const result = await this.executeWithTimeout(server, operation, this.config.requestTimeout);
        
        const duration = Date.now() - startTime;
        this.logger.debug(`RPC operation '${operationName}' completed in ${duration}ms`);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`RPC operation '${operationName}' failed on attempt ${attempt + 1}: ${error.message}`);
        
        // Continue to next node
        this.moveToNextNode();
      }
    }

    this.logger.error(`All RPC nodes failed for operation '${operationName}'`);
    throw lastError!;
  }

  private async executeWithTimeout<T>(
    server: SorobanRpc.Server,
    operation: (server: SorobanRpc.Server) => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`RPC operation timed out after ${timeout}ms`));
      }, timeout);

      operation(server)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private selectHealthyNode(): RpcNode | null {
    // Try current node first
    const currentNode = this.rpcNodes[this.currentNodeIndex];
    if (currentNode && currentNode.isHealthy) {
      return currentNode;
    }

    // Find any healthy node
    const healthyNodes = this.rpcNodes.filter(node => node.isHealthy);
    if (healthyNodes.length === 0) {
      return null;
    }

    // Select the highest priority healthy node
    const selectedNode = healthyNodes.reduce((best, current) => 
      current.priority < best.priority ? current : best
    );

    this.currentNodeIndex = this.rpcNodes.indexOf(selectedNode);
    return selectedNode;
  }

  private moveToNextNode(): void {
    this.currentNodeIndex = (this.currentNodeIndex + 1) % this.rpcNodes.length;
  }

  private handleNodeFailure(node: RpcNode, error: Error): void {
    node.consecutiveFailures++;
    node.isHealthy = false;
    node.lastHealthCheck = new Date();

    this.logger.warn(`RPC node ${node.name} failed (consecutive failures: ${node.consecutiveFailures}): ${error.message}`);

    if (node.consecutiveFailures >= this.config.circuitBreaker.failureThreshold) {
      this.logger.error(`RPC node ${node.name} marked as unhealthy after ${node.consecutiveFailures} consecutive failures`);
    }

    this.totalFailures++;
    
    if (this.totalFailures >= this.config.circuitBreaker.failureThreshold) {
      this.triggerCircuitBreaker();
    }
  }

  private triggerCircuitBreaker(): void {
    this.circuitBreakerState = 'OPEN';
    this.lastFailureTime = Date.now();
    this.logger.error(`Circuit breaker triggered - ${this.totalFailures} total failures detected`);
  }

  private async testRpcConnection(server: SorobanRpc.Server): Promise<void> {
    // Simple health check - get latest ledger
    await server.getLatestLedger();
  }

  @Interval(30000) // Default health check interval, will be overridden by config
  async performHealthCheck(): Promise<void> {
    const healthCheckPromises = this.rpcNodes.map(async (node) => {
      try {
        const startTime = Date.now();
        const server = new SorobanRpc.Server(node.url, {
          allowHttp: node.url.startsWith('http://'),
        });
        
        await this.testRpcConnection(server);
        
        node.responseTime = Date.now() - startTime;
        node.isHealthy = true;
        node.consecutiveFailures = 0;
        node.lastHealthCheck = new Date();
        
        this.logger.debug(`Health check passed for ${node.name} (${node.responseTime}ms)`);
      } catch (error) {
        node.isHealthy = false;
        node.consecutiveFailures++;
        node.lastHealthCheck = new Date();
        
        this.logger.warn(`Health check failed for ${node.name}: ${error.message}`);
      }
    });

    await Promise.allSettled(healthCheckPromises);
    
    // Log current status
    const healthyCount = this.rpcNodes.filter(node => node.isHealthy).length;
    this.logger.debug(`Health check completed: ${healthyCount}/${this.rpcNodes.length} nodes healthy`);
  }

  private async performInitialHealthCheck(): Promise<void> {
    this.logger.log('Performing initial health check on all RPC nodes...');
    await this.performHealthCheck();
    
    const healthyNodes = this.rpcNodes.filter(node => node.isHealthy);
    if (healthyNodes.length === 0) {
      this.logger.error('No healthy RPC nodes available after initial health check');
    } else {
      this.logger.log(`${healthyNodes.length} healthy RPC nodes available`);
    }
  }

  /**
   * Get current status of all RPC nodes
   */
  getRpcStatus(): RpcNode[] {
    return this.rpcNodes.map(node => ({ ...node }));
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): string {
    return this.circuitBreakerState;
  }

  /**
   * Force switch to a specific RPC node
   */
  async forceSwitchToNode(nodeName: string): Promise<void> {
    const targetNode = this.rpcNodes.find(node => node.name === nodeName);
    if (!targetNode) {
      throw new Error(`RPC node '${nodeName}' not found`);
    }

    if (!targetNode.isHealthy) {
      throw new Error(`RPC node '${nodeName}' is not healthy`);
    }

    this.currentNodeIndex = this.rpcNodes.indexOf(targetNode);
    this.logger.warn(`Manually switched to RPC node: ${nodeName}`);
  }

  /**
   * Reset circuit breaker to closed state
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'CLOSED';
    this.totalFailures = 0;
    this.lastFailureTime = 0;
    this.logger.warn('Circuit breaker manually reset to CLOSED state');
  }
}
