import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { Sep24Service } from './sep24.service';
import { InitiateDepositDto, AnchorCallbackDto } from './dto/sep24.dto';

@Controller('sep24')
export class Sep24Controller {
  constructor(private readonly sep24Service: Sep24Service) {}

  @Post('deposit')
  async initiateDeposit(@Body() dto: InitiateDepositDto) {
    return this.sep24Service.initiateDeposit(dto);
  }

  @Get('deposit/:id')
  async getDepositStatus(@Param('id') id: string) {
    return this.sep24Service.getDepositStatus(id);
  }

  @Post('callback')
  @HttpCode(200)
  async handleCallback(@Body() dto: AnchorCallbackDto) {
    await this.sep24Service.handleAnchorCallback(
      dto.transaction.id,
      dto.transaction.status,
      dto.transaction,
    );
    return { success: true };
  }
}
