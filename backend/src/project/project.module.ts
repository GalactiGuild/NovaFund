import { Module } from '@nestjs/common';
import { ProjectResolver } from './project.resolver';
import { ProjectRelationsResolver } from './project-relations.resolver';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { StatsController } from './stats.controller';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { InvestmentIntentService } from './investment-intent.service';
import { InvestmentIntentResolver } from './investment-intent.resolver';
import { TaggerService } from './tagger.service';
import { StellarModule } from '../stellar/stellar.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [StellarModule, ReputationModule],
  providers: [
    ProjectResolver,
    ProjectRelationsResolver,
    ProjectService,
    SearchService,
    InvestmentIntentService,
    InvestmentIntentResolver,
    TaggerService,
  ],
  controllers: [ProjectController, StatsController, SearchController],
  exports: [ProjectService, SearchService, InvestmentIntentService, TaggerService],
})
export class ProjectModule {}
