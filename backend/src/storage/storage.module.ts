import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { HybridStorageService } from './hybrid-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [StorageService, HybridStorageService],
  exports: [StorageService, HybridStorageService],
})
export class StorageModule {}
