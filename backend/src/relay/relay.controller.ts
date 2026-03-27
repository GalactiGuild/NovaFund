import { Controller, Post, Body } from '@nestjs/common';
import { RelayService } from './relay.service';
import { RelayTransactionDto } from './dto/relay.dto';

@Controller('relay')
export class RelayController {
  constructor(private readonly relayService: RelayService) {}

  @Post('fee-bump')
  async relayFeeBump(@Body() dto: RelayTransactionDto) {
    return this.relayService.relayTransaction(dto.xdr);
  }
}
