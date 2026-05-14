import { Test, TestingModule } from '@nestjs/testing';
import { SimulatorService } from './simulator.service';
import { RpcFallbackService } from './rpc-fallback.service';
import { SorobanRpc, Transaction, Networks } from '@stellar/stellar-sdk';

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    Transaction: jest.fn().mockImplementation(() => ({
      toXDR: () => 'mocked-xdr',
    })),
  };
});

describe('SimulatorService', () => {
  let service: SimulatorService;
  let rpcFallbackService: RpcFallbackService;

  const mockRpcServer = {
    simulateTransaction: jest.fn(),
  };

  const mockRpcFallbackService = {
    getRpcServer: jest.fn().mockResolvedValue(mockRpcServer),
  };

  // Valid XDR for testing (a simple transaction)
  const validXdr = 'AAAAAgAAAAD9S7Lz9S7Lz9S7Lz9S7Lz9S7Lz9S7Lz9S7Lz9S7LzAAAAAwAAAAMAAAABAAAAAAAAAAEAAAAA';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulatorService,
        {
          provide: RpcFallbackService,
          useValue: mockRpcFallbackService,
        },
      ],
    }).compile();

    service = module.get<SimulatorService>(SimulatorService);
    rpcFallbackService = module.get<RpcFallbackService>(RpcFallbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('simulate', () => {
    it('should return success and fee when simulation passes', async () => {
      mockRpcServer.simulateTransaction.mockResolvedValue({
        minResourceFee: '1000',
        results: [],
        events: [],
      });

      const result = await service.simulate(validXdr);

      expect(result.success).toBe(true);
      expect(result.minResourceFee).toBe('1000');
      expect(mockRpcFallbackService.getRpcServer).toHaveBeenCalled();
      expect(mockRpcServer.simulateTransaction).toHaveBeenCalled();
    });

    it('should return failure and error when simulation has logic error', async () => {
      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'Contract logic error: insufficient balance',
      });

      const result = await service.simulate(validXdr);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contract logic error: insufficient balance');
    });

    it('should return failure and error when RPC call fails', async () => {
      mockRpcServer.simulateTransaction.mockRejectedValue(new Error('RPC connection timeout'));

      const result = await service.simulate(validXdr);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected simulation error: RPC connection timeout');
    });

    it('should handle unexpected response format', async () => {
      mockRpcServer.simulateTransaction.mockResolvedValue({
        // Missing both success data and error field
      });

      const result = await service.simulate(validXdr);

      // In our implementation, we check if 'error' in response. 
      // If not, we assume success but some fields might be undefined.
      expect(result.success).toBe(true);
    });
  });
});
