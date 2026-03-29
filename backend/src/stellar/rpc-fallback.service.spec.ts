import { Test, TestingModule } from '@nestjs/testing';
import { RpcFallbackService } from './rpc-fallback.service';
import { ConfigService } from '@nestjs/config';
import { SorobanRpc } from '@stellar/stellar-sdk';

describe('RpcFallbackService', () => {
  let service: RpcFallbackService;

  const mockConfigService = {
    get: jest.fn(),
    internalConfig: {},
    isCacheEnabled: false,
    cache: new Map(),
    _changes$: new Map(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'STELLAR_RPC_URL': 'https://soroban-testnet.stellar.org',
        'STELLAR_BACKUP_RPC_URLS': 'https://backup1.example.com,https://backup2.example.com',
        'RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD': 3,
        'RPC_CIRCUIT_BREAKER_RECOVERY_TIMEOUT': 60000,
        'RPC_CIRCUIT_BREAKER_MONITORING_PERIOD': 30000,
        'RPC_HEALTH_CHECK_INTERVAL': 30000,
        'RPC_REQUEST_TIMEOUT': 10000,
      };
      return config[key] || defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RpcFallbackService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RpcFallbackService>(RpcFallbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Configuration', () => {
    it('should load configuration correctly', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org');
      expect(mockConfigService.get).toHaveBeenCalledWith('STELLAR_BACKUP_RPC_URLS', '');
    });

    it('should handle empty backup URLs', async () => {
      const tempMockConfig = { ...mockConfigService };
      tempMockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'STELLAR_BACKUP_RPC_URLS') return '';
        return 'https://primary.example.com';
      });

      const tempModule = Test.createTestingModule({
        providers: [
          RpcFallbackService,
          {
            provide: ConfigService,
            useValue: tempMockConfig,
          },
        ],
      });

      const newService = (await tempModule.compile()).get<RpcFallbackService>(RpcFallbackService);
      expect(newService).toBeDefined();
    });
  });

  describe('getRpcServer', () => {
    it('should return a healthy RPC server', async () => {
      // Mock a successful RPC connection
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger').mockResolvedValue({
        sequence: 12345,
      } as any);

      const server = await service.getRpcServer();
      expect(server).toBeInstanceOf(SorobanRpc.Server);
    });

    it('should throw error when circuit breaker is open', async () => {
      // Manually trigger circuit breaker state
      service['circuitBreakerState'] = 'OPEN';
      service['lastFailureTime'] = Date.now();

      await expect(service.getRpcServer()).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to half-open after recovery timeout', async () => {
      service['circuitBreakerState'] = 'OPEN';
      service['lastFailureTime'] = Date.now() - 70000; // Past recovery timeout

      // Mock successful connection
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger').mockResolvedValue({
        sequence: 12345,
      } as any);

      const server = await service.getRpcServer();
      expect(server).toBeInstanceOf(SorobanRpc.Server);
      expect(service['circuitBreakerState']).toBe('CLOSED');
    });
  });

  describe('executeRpcOperation', () => {
    it('should execute operation successfully', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const operationName = 'test-operation';

      // Mock successful RPC connection
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger').mockResolvedValue({
        sequence: 12345,
      } as any);

      const result = await service.executeRpcOperation(mockOperation, operationName);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should retry on failure and try next node', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('RPC failed'));
      const operationName = 'test-operation';

      // Mock failed connections
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger').mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(service.executeRpcOperation(mockOperation, operationName)).rejects.toThrow();
      expect(mockOperation).toHaveBeenCalledTimes(service['rpcNodes'].length);
    });
  });

  describe('Health checking', () => {
    it('should perform health check on all nodes', async () => {
      // Mock successful health checks
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger').mockResolvedValue({
        sequence: 12345,
      } as any);

      await service.performHealthCheck();

      const status = service.getRpcStatus();
      expect(status.every(node => node.isHealthy)).toBe(true);
    });

    it('should mark unhealthy nodes on health check failure', async () => {
      // Mock failed health check for first node
      jest.spyOn(SorobanRpc.Server.prototype, 'getLatestLedger')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue({ sequence: 12345 } as any);

      await service.performHealthCheck();

      const status = service.getRpcStatus();
      expect(status[0].isHealthy).toBe(false);
      expect(status[1].isHealthy).toBe(true);
    });
  });

  describe('Circuit breaker', () => {
    it('should trigger circuit breaker after threshold failures', () => {
      const initialFailureCount = service['totalFailures'];
      service['totalFailures'] = service['config'].circuitBreaker.failureThreshold;
      
      service['triggerCircuitBreaker']();
      
      expect(service['circuitBreakerState']).toBe('OPEN');
    });

    it('should reset circuit breaker', () => {
      service['circuitBreakerState'] = 'OPEN';
      service['totalFailures'] = 5;
      
      service.resetCircuitBreaker();
      
      expect(service['circuitBreakerState']).toBe('CLOSED');
      expect(service['totalFailures']).toBe(0);
    });
  });

  describe('Node management', () => {
    it('should force switch to specific node', async () => {
      const nodeName = 'Backup-1';
      
      // Ensure node is healthy
      const status = service.getRpcStatus();
      const targetNode = status.find(node => node.name === nodeName);
      if (targetNode) {
        targetNode.isHealthy = true;
      }

      await service.forceSwitchToNode(nodeName);
      
      const currentStatus = service.getRpcStatus();
      const currentIndex = service['currentNodeIndex'];
      expect(currentStatus[currentIndex].name).toBe(nodeName);
    });

    it('should throw error when switching to non-existent node', async () => {
      await expect(service.forceSwitchToNode('NonExistent')).rejects.toThrow('not found');
    });

    it('should throw error when switching to unhealthy node', async () => {
      const nodeName = 'Primary';
      
      // Mark node as unhealthy
      const status = service.getRpcStatus();
      const targetNode = status.find(node => node.name === nodeName);
      if (targetNode) {
        targetNode.isHealthy = false;
      }

      await expect(service.forceSwitchToNode(nodeName)).rejects.toThrow('not healthy');
    });
  });

  describe('Status reporting', () => {
    it('should return RPC status', () => {
      const status = service.getRpcStatus();
      
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
      
      status.forEach(node => {
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('url');
        expect(node).toHaveProperty('isHealthy');
        expect(node).toHaveProperty('consecutiveFailures');
        expect(node).toHaveProperty('lastHealthCheck');
      });
    });

    it('should return circuit breaker state', () => {
      const state = service.getCircuitBreakerState();
      
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });
  });
});
