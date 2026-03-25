import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { BridgeStatus } from './enums/bridge-status.enum';
import { RegisterBridgeTxDto, BridgeTxStatusDto } from './dto/bridge.dto';

/**
 * Checks a transaction hash against a chain's scanner API.
 * Returns the raw status string from the scanner, or null on failure.
 */
interface ChainAdapter {
  checkTx(txHash: string): Promise<{ confirmed: boolean; failed: boolean; destTxHash?: string }>;
}

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);

  // Simple chain adapter map — extend with real scanner URLs via config
  private readonly adapters: Record<string, ChainAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.adapters = this.buildAdapters();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async register(dto: RegisterBridgeTxDto): Promise<BridgeTxStatusDto> {
    const record = await this.prisma.bridgeTransaction.upsert({
      where: { sourceTxHash: dto.sourceTxHash },
      create: {
        sourceTxHash: dto.sourceTxHash,
        sourceChain: dto.sourceChain,
        destChain: dto.destChain,
        senderAddress: dto.senderAddress,
        receiverAddress: dto.receiverAddress,
        amount: dto.amount,
        asset: dto.asset,
        status: BridgeStatus.INITIATED,
        statusMessage: `Transaction submitted on ${dto.sourceChain}`,
      },
      update: {},
    });

    return this.toDto(record);
  }

  async getStatus(sourceTxHash: string): Promise<BridgeTxStatusDto> {
    const record = await this.prisma.bridgeTransaction.findUnique({
      where: { sourceTxHash },
    });

    if (!record) {
      throw new NotFoundException(`Bridge transaction ${sourceTxHash} not found`);
    }

    return this.toDto(record);
  }

  async listActive(): Promise<BridgeTxStatusDto[]> {
    const records = await this.prisma.bridgeTransaction.findMany({
      where: {
        status: { in: [BridgeStatus.INITIATED, BridgeStatus.BRIDGING] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDto(r));
  }

  // ---------------------------------------------------------------------------
  // Polling logic — called by the cron task
  // ---------------------------------------------------------------------------

  async pollPendingTransactions(): Promise<void> {
    const pending = await this.prisma.bridgeTransaction.findMany({
      where: {
        status: { in: [BridgeStatus.INITIATED, BridgeStatus.BRIDGING] },
      },
    });

    if (pending.length === 0) return;

    this.logger.debug(`Polling ${pending.length} pending bridge transaction(s)`);

    for (const tx of pending) {
      try {
        await this.checkAndUpdateTx(tx);
      } catch (err) {
        this.logger.error(`Failed to poll tx ${tx.sourceTxHash}: ${err.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async checkAndUpdateTx(tx: any): Promise<void> {
    const sourceAdapter = this.adapters[tx.sourceChain.toLowerCase()];
    const destAdapter = this.adapters[tx.destChain.toLowerCase()];

    // --- Step 1: check source chain ---
    if (tx.status === BridgeStatus.INITIATED && sourceAdapter) {
      const sourceResult = await sourceAdapter.checkTx(tx.sourceTxHash);

      if (sourceResult.failed) {
        await this.updateStatus(tx.sourceTxHash, BridgeStatus.FAILED, {
          statusMessage: `Transaction failed on ${tx.sourceChain}`,
          failedAt: new Date(),
        });
        return;
      }

      if (sourceResult.confirmed) {
        // Source confirmed → now bridging to destination
        await this.updateStatus(tx.sourceTxHash, BridgeStatus.BRIDGING, {
          statusMessage: `Confirmed on ${tx.sourceChain}, awaiting arrival on ${tx.destChain}`,
          destTxHash: sourceResult.destTxHash ?? null,
        });
        return;
      }

      // Still pending on source — update lastCheckedAt only
      await this.prisma.bridgeTransaction.update({
        where: { sourceTxHash: tx.sourceTxHash },
        data: { lastCheckedAt: new Date() },
      });
      return;
    }

    // --- Step 2: check destination chain ---
    if (tx.status === BridgeStatus.BRIDGING && destAdapter) {
      const hashToCheck = tx.destTxHash ?? tx.sourceTxHash;
      const destResult = await destAdapter.checkTx(hashToCheck);

      if (destResult.failed) {
        await this.updateStatus(tx.sourceTxHash, BridgeStatus.FAILED, {
          statusMessage: `Transaction failed on ${tx.destChain}`,
          failedAt: new Date(),
        });
        return;
      }

      if (destResult.confirmed) {
        await this.updateStatus(tx.sourceTxHash, BridgeStatus.ARRIVED, {
          statusMessage: `Arrived on ${tx.destChain}`,
          arrivedAt: new Date(),
          destTxHash: destResult.destTxHash ?? tx.destTxHash,
        });
        return;
      }

      await this.prisma.bridgeTransaction.update({
        where: { sourceTxHash: tx.sourceTxHash },
        data: { lastCheckedAt: new Date() },
      });
    }
  }

  private async updateStatus(
    sourceTxHash: string,
    status: BridgeStatus,
    extra: Record<string, any> = {},
  ): Promise<void> {
    await this.prisma.bridgeTransaction.update({
      where: { sourceTxHash },
      data: { status, lastCheckedAt: new Date(), ...extra },
    });

    this.logger.log(`Bridge tx ${sourceTxHash} → ${status}. ${extra.statusMessage ?? ''}`);
  }

  private toDto(record: any): BridgeTxStatusDto {
    return {
      id: record.id,
      sourceTxHash: record.sourceTxHash,
      destTxHash: record.destTxHash,
      sourceChain: record.sourceChain,
      destChain: record.destChain,
      status: record.status as BridgeStatus,
      statusMessage: record.statusMessage,
      amount: record.amount,
      asset: record.asset,
      senderAddress: record.senderAddress,
      receiverAddress: record.receiverAddress,
      lastCheckedAt: record.lastCheckedAt,
      arrivedAt: record.arrivedAt,
      failedAt: record.failedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Chain adapters — each calls the relevant public scanner API
  // ---------------------------------------------------------------------------

  private buildAdapters(): Record<string, ChainAdapter> {
    const etherscanKey = this.config.get<string>('ETHERSCAN_API_KEY', '');
    const stellarHorizon = this.config.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );

    return {
      ethereum: this.buildEtherscanAdapter('https://api.etherscan.io/api', etherscanKey),
      'ethereum-testnet': this.buildEtherscanAdapter(
        'https://api-sepolia.etherscan.io/api',
        etherscanKey,
      ),
      stellar: this.buildStellarAdapter(stellarHorizon),
      'stellar-testnet': this.buildStellarAdapter('https://horizon-testnet.stellar.org'),
    };
  }

  private buildEtherscanAdapter(baseUrl: string, apiKey: string): ChainAdapter {
    return {
      checkTx: async (txHash: string) => {
        try {
          const url = `${baseUrl}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${apiKey}`;
          const res = await fetch(url);
          const json = (await res.json()) as any;

          // status "1" = success, "0" = failed, "" = still pending
          if (json.result?.status === '1') return { confirmed: true, failed: false };
          if (json.result?.status === '0') return { confirmed: false, failed: true };
          return { confirmed: false, failed: false };
        } catch {
          return { confirmed: false, failed: false };
        }
      },
    };
  }

  private buildStellarAdapter(horizonUrl: string): ChainAdapter {
    return {
      checkTx: async (txHash: string) => {
        try {
          const res = await fetch(`${horizonUrl}/transactions/${txHash}`);
          if (res.status === 404) return { confirmed: false, failed: false };

          const json = (await res.json()) as any;
          if (json.successful === true) return { confirmed: true, failed: false };
          if (json.successful === false) return { confirmed: false, failed: true };
          return { confirmed: false, failed: false };
        } catch {
          return { confirmed: false, failed: false };
        }
      },
    };
  }
}
