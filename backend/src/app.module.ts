import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { UserController } from './user.controller';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    RedisModule,
    StellarModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
    }),
    ReputationModule,
    DatabaseModule,
    IndexerModule,
    NotificationModule,
    BridgeModule,
    YieldModule,
    RelayModule,
    VerificationModule,
    ProjectModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService],
})
export class AppModule {}
