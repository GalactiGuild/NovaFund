import { Controller, Get, Param, Post, Put, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AccountSecurityService } from './user/account-security.service';
import { AdminGuard } from './guards/admin.guard';

@Controller('api/user')
export class UserController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountSecurity: AccountSecurityService,
  ) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return { error: 'User not found' };
    // Only return relevant fields
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      reputationScore: user.reputationScore,
      trustScore: user.trustScore,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Post(':id/freeze-request')
  async submitFreezeRequest(
    @Param('id') userId: string,
    @Body() body: { reporterId: string; reason: string; evidenceUrl?: string },
  ) {
    return this.accountSecurity.submitFreezeRequest(
      userId,
      body.reporterId,
      body.reason,
      body.evidenceUrl,
    );
  }

  @Get(':id/freeze-requests')
  async getFreezeRequests(@Param('id') userId: string) {
    return this.accountSecurity.getFreezeRequests(userId);
  }

  @Put('freeze-request/:requestId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reviewFreezeRequest(
    @Param('requestId') requestId: string,
    @Body() body: { adminId: string; approved: boolean; adminNotes?: string },
  ) {
    return this.accountSecurity.reviewFreezeRequest(
      requestId,
      body.adminId,
      body.approved,
      body.adminNotes,
    );
  }

  @Put(':id/unfreeze')
  @UseGuards(AdminGuard)
  async unfreezeAccount(
    @Param('id') userId: string,
    @Body() body: { adminId: string; reason: string },
  ) {
    return this.accountSecurity.unfreezeAccount(userId, body.adminId, body.reason);
  }

  @Get(':id/frozen-status')
  async getFrozenStatus(@Param('id') userId: string) {
    const isFrozen = await this.accountSecurity.isAccountFrozen(userId);
    return { isFrozen };
  }

  @Get('freeze-requests/pending')
  @UseGuards(AdminGuard)
  async getPendingFreezeRequests() {
    return this.accountSecurity.getPendingFreezeRequests();
  }

  @Post(':id/can-transact')
  async canProceedWithTransaction(@Param('id') userId: string) {
    return this.accountSecurity.canProceedWithTransaction(userId);
  }
}
