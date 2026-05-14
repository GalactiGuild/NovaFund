import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import {
  createComplexityRule,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { ReputationModule } from './reputation/reputation.module';
import { DatabaseModule } from './database.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationModule } from './notification/notification.module';
import { BridgeModule } from './bridge/bridge.module';
import { YieldModule } from './yield/yield.module';
import { RelayModule } from './relay/relay.module';
import { VerificationModule } from './verification/verification.module';
import { RedisModule } from './redis/redis.module';
import { ProjectModule } from './project/project.module';
import { StellarModule } from './stellar/stellar.module';
import { OracleModule } from './oracle/oracle.module';
import { GraphQLRateLimitModule } from './graphql/graphql-rate-limit.module';
import { DataLoaderModule } from './graphql/dataloaders/dataloader.module';
import { DataLoaderFactory } from './graphql/dataloaders/dataloader.factory';
import { UserModule } from './user/user.module';
import { ShortlinkModule } from './shortlink/shortlink.module';
import { AdminModule } from './admin/admin.module';
import { SupportModule } from './support/support.module';
import { GovernanceModule } from './governance/governance.module';
import { ApiModule } from './api/api.module';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceGuard } from './guards/maintenance.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    RedisModule,
    StellarModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      imports: [ConfigModule, DataLoaderModule],
      inject: [ConfigService, DataLoaderFactory],
      useFactory: (config: ConfigService, dataLoaderFactory: DataLoaderFactory) => {
        const maxQueryCost = config.get<number>('GRAPHQL_MAX_QUERY_COST', 1000);

        return {
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: true,
          context: () => dataLoaderFactory.createContext(),
          validationRules: [
            createComplexityRule({
              maximumComplexity: maxQueryCost,
              variables: {},
              estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
            }),
          ],
        };
      },
    }),
    GraphQLRateLimitModule,
    ReputationModule,
    DatabaseModule,
    IndexerModule,
    NotificationModule,
    BridgeModule,
    YieldModule,
    RelayModule,
    VerificationModule,
    ProjectModule,
    OracleModule,
    UserModule,
    ShortlinkModule,
    SupportModule,
    AdminModule,
    GovernanceModule,
    ApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
})
export class AppModule {}
