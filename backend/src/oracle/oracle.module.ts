import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { oracleConfig } from '../config/oracle.config';
import { PriceOracleService } from './price-oracle.service';
import { PriceFetchTask } from './price-fetch.task';
import { PriceOracleController } from './price-oracle.controller';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [
    ConfigModule.forFeature(oracleConfig),
    DatabaseModule,
  ],
  providers: [PriceOracleService, PriceFetchTask],
  controllers: [PriceOracleController],
  exports: [PriceOracleService],
})
export class OracleModule {}
