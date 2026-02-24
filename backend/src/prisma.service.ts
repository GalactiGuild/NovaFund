import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import prisma from '../prisma/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: PrismaClient;

  constructor() {
    this.prismaClient = prisma;
  }

  async onModuleInit() {
    // Connection is handled by the prisma config
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
  }

  get client(): PrismaClient {
    return this.prismaClient;
  }
}
