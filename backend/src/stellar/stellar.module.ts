import { Module } from '@nestjs/common';
import { RpcFallbackService } from './rpc-fallback.service';
import { RpcFallbackController } from './rpc-fallback.controller';

@Module({
  providers: [RpcFallbackService],
  controllers: [RpcFallbackController],
  exports: [RpcFallbackService],
})
export class StellarModule {}
