import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Horizon } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma.service';

interface AssetVolumeEntry {
  assetCode: string;
  assetIssuer?: string;
  tradedVolume: string;
}

@Injectable()
export class EcosystemSyncService {
  private readonly logger = new Logger(EcosystemSyncService.name);
  private readonly horizonServer: Horizon.Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncEcosystemSnapshot(): Promise<void> {
    try {
      const snapshot = await this.buildSnapshot();
      const snapshotDate = this.startOfUtcDay(new Date());

      await (this.prisma as any).stellarEcosystemSnapshot.upsert({
        where: { snapshotDate },
        create: {
          snapshotDate,
          topTradedAssets: snapshot.topTradedAssets,
          dexVolume24h: snapshot.dexVolume24h,
          rwaDexVolume24h: snapshot.rwaDexVolume24h,
          source: 'horizon',
          capturedAt: new Date(),
        },
        update: {
          topTradedAssets: snapshot.topTradedAssets,
          dexVolume24h: snapshot.dexVolume24h,
          rwaDexVolume24h: snapshot.rwaDexVolume24h,
          capturedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to sync Stellar ecosystem snapshot: ${error.message}`);
    }
  }

  async getLatestSnapshot() {
    return (this.prisma as any).stellarEcosystemSnapshot.findFirst({
      orderBy: { capturedAt: 'desc' },
    });
  }

  async syncNow() {
    await this.syncEcosystemSnapshot();
    return this.getLatestSnapshot();
  }

  private async buildSnapshot(): Promise<{
    topTradedAssets: AssetVolumeEntry[];
    dexVolume24h: bigint;
    rwaDexVolume24h: bigint;
  }> {
    const response = await this.horizonServer.trades().order('desc').limit(200).call();
    const assetVolumes = new Map<string, bigint>();

    for (const trade of response.records) {
      const baseKey = this.assetKey(trade.base_asset_type, trade.base_asset_code, trade.base_asset_issuer);
      const counterKey = this.assetKey(
        trade.counter_asset_type,
        trade.counter_asset_code,
        trade.counter_asset_issuer,
      );

      const baseAmount = this.toStroops(trade.base_amount);
      const counterAmount = this.toStroops(trade.counter_amount);

      assetVolumes.set(baseKey, (assetVolumes.get(baseKey) ?? 0n) + baseAmount);
      assetVolumes.set(counterKey, (assetVolumes.get(counterKey) ?? 0n) + counterAmount);
    }

    const sortedAssets = [...assetVolumes.entries()]
      .sort((a, b) => (a[1] > b[1] ? -1 : 1))
      .slice(0, 10)
      .map(([key, volume]) => {
        const [assetCode, assetIssuer] = key.split(':');
        return {
          assetCode,
          assetIssuer: assetIssuer || undefined,
          tradedVolume: volume.toString(),
        };
      });

    const trackedTokens = this.configService
      .get<string>('RWA_TRACKED_ASSETS', 'USDC,EURC,NGNC')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const dexVolume24h = [...assetVolumes.values()].reduce((sum, value) => sum + value, 0n);
    const rwaDexVolume24h = [...assetVolumes.entries()].reduce((sum, [key, value]) => {
      const [assetCode] = key.split(':');
      return trackedTokens.includes(assetCode.toUpperCase()) ? sum + value : sum;
    }, 0n);

    return {
      topTradedAssets: sortedAssets,
      dexVolume24h,
      rwaDexVolume24h,
    };
  }

  private assetKey(type: string, code?: string, issuer?: string): string {
    if (type === 'native') {
      return 'XLM:';
    }

    return `${code ?? 'UNKNOWN'}:${issuer ?? ''}`;
  }

  private toStroops(amount: string): bigint {
    return BigInt(Math.floor(parseFloat(amount) * 10_000_000));
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
