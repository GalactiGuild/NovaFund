import { Controller, Patch, Param, Body } from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { MilestoneService } from './milestone.service';
import { IsEnum } from 'class-validator';

class UpdateMilestoneStatusDto {
  @IsEnum(MilestoneStatus)
  status: MilestoneStatus;
}

@Controller('milestones')
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  /**
   * PATCH /milestones/:id/status
   * Body: { "status": "DISPUTED" }
   *
   * When status === "DISPUTED", notifications are automatically
   * dispatched to all project investors.
   */
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateMilestoneStatusDto) {
    return this.milestoneService.updateStatus(id, dto.status);
  }

  @Patch(':id')
  async getOne(@Param('id') id: string) {
    return this.milestoneService.findById(id);
  }
}
