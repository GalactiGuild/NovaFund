import { Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { RegisterBridgeTxDto, BridgeTxStatusDto, BridgeTxQueryDto } from './dto/bridge.dto';

@Controller('bridge')
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  /**
   * Register a new cross-chain transaction to be tracked.
   * POST /bridge/transactions
   */
  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterBridgeTxDto): Promise<BridgeTxStatusDto> {
    return this.bridgeService.register(dto);
  }

  /**
   * Get the unified status of a specific bridge transaction.
   * GET /bridge/transactions/:sourceTxHash
   */
  @Get('transactions/:sourceTxHash')
  async getStatus(@Param('sourceTxHash') sourceTxHash: string): Promise<BridgeTxStatusDto> {
    return this.bridgeService.getStatus(sourceTxHash);
  }

  /**
   * List all active (non-terminal) bridge transactions.
   * GET /bridge/transactions
   */
  @Get('transactions')
  async listActive(@Query() _query: BridgeTxQueryDto): Promise<BridgeTxStatusDto[]> {
    return this.bridgeService.listActive();
  }
}
