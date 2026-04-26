import { Module } from '@nestjs/common';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { InvestmentIntentService } from './investment-intent.service';
import { InvestmentIntentResolver } from './investment-intent.resolver';
import { TaggerService } from './tagger.service';
import { StellarModule } from '../stellar/stellar.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [StellarModule, ReputationModule],
  providers: [
    ProjectResolver,
    ProjectService,
    InvestmentIntentService,
    InvestmentIntentResolver,
    TaggerService,
  ],
  controllers: [ProjectController],
  exports: [ProjectService, InvestmentIntentService, TaggerService],
})
export class ProjectModule {}
