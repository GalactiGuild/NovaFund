import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { KYCService } from './kyc.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/kyc')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  @Post('override')
  async override(@Body() body: { userId: string; action: 'APPROVE' | 'REJECT'; reason?: string }, req: any) {
    const adminId = req.user.id;
    return this.kycService.overrideKYC(body.userId, adminId, body.action, body.reason);
  }

  @Get('audits')
  async audits() {
    return this.kycService.listAudits();
  }
}
