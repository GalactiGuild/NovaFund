import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { KycAdminService } from '../services/kyc-admin.service';
import { KycOverrideDto } from '../dto/kyc-override.dto';
import { AdminGuard } from '../../guards/admin.guard';

@Controller('admin/kyc')
@UseGuards(AdminGuard)
export class KycAdminController {
  constructor(private readonly kycService: KycAdminService) {}

  @Post('override')
  async override(@Body() dto: KycOverrideDto, @Req() req: any) {
    return this.kycService.overrideKyc(dto, req.user.id);
  }

  @Post(':userId/approve')
  async approve(@Param('userId') userId: string, @Req() req: any) {
    return this.kycService.approveKyc(userId, req.user.id);
  }

  @Post(':userId/reject')
  async reject(
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.kycService.rejectKyc(
      userId,
      req.user.id,
      body.reason,
    );
  }
}