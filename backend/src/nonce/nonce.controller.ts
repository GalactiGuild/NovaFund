import { Controller, Post } from '@nestjs/common';
import { NonceService } from './nonce.service';

@Controller('nonce')
export class NonceController {
  constructor(private readonly nonceService: NonceService) {}

  @Post()
  async getNonce(): Promise<string> {
    return this.nonceService.generateNonce();
  }
}