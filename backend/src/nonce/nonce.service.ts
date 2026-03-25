import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class NonceService {
  generateNonce(): string {
    const nonce = randomBytes(16).toString('hex');
    return nonce;
  }
}
