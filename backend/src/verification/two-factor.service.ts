import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

const LARGE_PAYOUT_THRESHOLD_USD = 10_000;

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.appName = this.config.get<string>('APP_NAME', 'NovaFund');
  }

  async generateSecret(userId: string): Promise<{ otpauthUrl: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({ name: `${this.appName} (${userId})` });

    await this.prisma.twoFactorSecret.upsert({
      where: { userId },
      create: { userId, secret: secret.base32, verified: false },
      update: { secret: secret.base32, verified: false },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    return { otpauthUrl: secret.otpauth_url!, qrCode };
  }

  async verifyAndEnable(userId: string, token: string): Promise<void> {
    const record = await this.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record) throw new UnauthorizedException('2FA not set up');

    const valid = speakeasy.totp.verify({
      secret: record.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('Invalid TOTP token');

    await this.prisma.twoFactorSecret.update({
      where: { userId },
      data: { verified: true },
    });

    this.logger.log(`2FA enabled for user ${userId}`);
  }

  /**
   * Call this before authorising any payout above the threshold.
   * Throws UnauthorizedException if 2FA is required but token is missing/invalid.
   */
  async requireForLargePayout(
    userId: string,
    amountUsd: number,
    token?: string,
  ): Promise<void> {
    if (amountUsd < LARGE_PAYOUT_THRESHOLD_USD) return;

    const record = await this.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record?.verified) {
      this.logger.warn(`User ${userId} attempted large payout without 2FA enabled`);
      throw new UnauthorizedException('2FA must be enabled for payouts over $10,000');
    }

    if (!token) throw new UnauthorizedException('TOTP token required for large payout');

    const valid = speakeasy.totp.verify({
      secret: record.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('Invalid TOTP token');
    this.logger.log(`2FA verified for large payout by user ${userId}`);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const record = await this.prisma.twoFactorSecret.findUnique({ where: { userId } });
    return record?.verified ?? false;
  }
}
