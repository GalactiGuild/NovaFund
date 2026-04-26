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
import { UserModule } from './user/user.module';
import { ShortlinkModule } from './shortlink/shortlink.module';
import { AdminModule } from './admin/admin.module';
import { SupportModule } from './support/support.module';

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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const maxQueryCost = config.get<number>('GRAPHQL_MAX_QUERY_COST', 1000);

        return {
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
