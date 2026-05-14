import { Module } from '@nestjs/common';
import { InstitutionalController } from './institutional.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InstitutionalController],
  providers: [PrismaService],
})
export class ApiModule {}
