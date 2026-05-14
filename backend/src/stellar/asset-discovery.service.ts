import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { RpcFallbackService } from './rpc-fallback.service';
import { Horizon } from '@stellar/stellar-sdk';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface AssetDiscoveryConfig {
  minLiquidityScore: number;
  minVolume24h: bigint;
  minHoldersCount: number;
  requiredTags: string[];
  scanIntervalHours: number;
  maxAssetsPerScan: number;
  homeDomainTimeout: number;
}

export interface DiscoveredAssetInfo {
  assetCode: string;
  assetIssuer?: string;
  assetType: 'NATIVE' | 'CREDIT_ALPHANUM4' | 'CREDIT_ALPHANUM12' | 'LIQUIDITY_POOL_SHARES';
  homeDomain?: string;
  tomlInfo?: any;
  tags: string[];
  liquidityScore: number;
  volume24h: bigint;
  holdersCount: number;
  trustlinesCount: number;
  lastActivity?: Date;
}

@Injectable()
export class AssetDiscoveryService {
  private readonly logger = new Logger(AssetDiscoveryService.name);
  private readonly config: Required<AssetDiscoveryConfig>;
  private horizonServer: Horizon.Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rpcService: RpcFallbackService,
  ) {
    this.config = this.loadConfiguration();
    this.initializeHorizon();
  }

  private loadConfiguration(): Required<AssetDiscoveryConfig> {
    return {
      minLiquidityScore: parseFloat(this.configService.get('ASSET_DISCOVERY_MIN_LIQUIDITY_SCORE', '7.5')),
      minVolume24h: BigInt(this.configService.get('ASSET_DISCOVERY_MIN_VOLUME_24H', '10000000000')), // 1000 XLM in stroops
      minHoldersCount: parseInt(this.configService.get('ASSET_DISCOVERY_MIN_HOLDERS_COUNT', '100'), 10),
      requiredTags: this.configService.get('ASSET_DISCOVERY_REQUIRED_TAGS', 'RWA,Stable').split(','),
      scanIntervalHours: parseInt(this.configService.get('ASSET_DISCOVERY_SCAN_INTERVAL_HOURS', '24'), 10),
      maxAssetsPerScan: parseInt(this.configService.get('ASSET_DISCOVERY_MAX_ASSETS_PER_SCAN', '100'), 10),
      homeDomainTimeout: parseInt(this.configService.get('ASSET_DISCOVERY_HOME_DOMAIN_TIMEOUT', '5000'), 10),
    };
  }

  private initializeHorizon() {
    const horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  /**
   * Scheduled job to scan for new assets
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scanForAssets() {
    this.logger.log('Starting scheduled asset discovery scan');

    try {
      const discoveredAssets = await this.performAssetScan();
      const newAssets = await this.filterNewAssets(discoveredAssets);
      const proposedAssets = await this.proposeAssetsForReview(newAssets);

      this.logger.log(`Asset discovery scan completed: ${discoveredAssets.length} discovered, ${newAssets.length} new, ${proposedAssets.length} proposed`);
    } catch (error) {
      this.logger.error('Asset discovery scan failed', error);
    }
  }

  /**
   * Manual trigger for asset discovery
   */
  async manualAssetScan(): Promise<{ discovered: number; new: number; proposed: number }> {
    this.logger.log('Starting manual asset discovery scan');

    const discoveredAssets = await this.performAssetScan();
    const newAssets = await this.filterNewAssets(discoveredAssets);
    const proposedAssets = await this.proposeAssetsForReview(newAssets);

    return {
      discovered: discoveredAssets.length,
      new: newAssets.length,
      proposed: proposedAssets.length,
    };
  }

  /**
   * Perform the actual asset scanning on Stellar network
   */
  private async performAssetScan(): Promise<DiscoveredAssetInfo[]> {
    const discoveredAssets: DiscoveredAssetInfo[] = [];

    try {
      // Get assets with high trading volume from the last 24 hours
      const tradesCall = this.horizonServer.trades()
        .limit(this.config.maxAssetsPerScan)
        .order('desc')
        .call();

      const trades = await tradesCall;

      // Group trades by asset to calculate volume and liquidity
      const assetStats = new Map<string, {
        volume: bigint;
        trades: number;
        lastActivity: Date;
        holders: Set<string>;
      }>();

      for (const trade of trades.records) {
        const baseAssetKey = this.getAssetKey(trade.base_asset_type, trade.base_asset_code, trade.base_asset_issuer);
        const counterAssetKey = this.getAssetKey(trade.counter_asset_type, trade.counter_asset_code, trade.counter_asset_issuer);

        // Process base asset
        if (!assetStats.has(baseAssetKey)) {
          assetStats.set(baseAssetKey, {
            volume: BigInt(0),
            trades: 0,
            lastActivity: new Date(trade.ledger_close_time),
            holders: new Set(),
          });
        }
        const baseStats = assetStats.get(baseAssetKey)!;
        baseStats.volume += BigInt(Math.floor(parseFloat(trade.base_amount) * 10000000)); // Convert to stroops
        baseStats.trades++;
        if (new Date(trade.ledger_close_time) > baseStats.lastActivity) {
          baseStats.lastActivity = new Date(trade.ledger_close_time);
        }

        // Process counter asset
        if (!assetStats.has(counterAssetKey)) {
          assetStats.set(counterAssetKey, {
            volume: BigInt(0),
            trades: 0,
            lastActivity: new Date(trade.ledger_close_time),
            holders: new Set(),
          });
        }
        const counterStats = assetStats.get(counterAssetKey)!;
        counterStats.volume += BigInt(Math.floor(parseFloat(trade.counter_amount) * 10000000));
        counterStats.trades++;
        if (new Date(trade.ledger_close_time) > counterStats.lastActivity) {
          counterStats.lastActivity = new Date(trade.ledger_close_time);
        }
      }

      // Filter assets by minimum criteria and enrich with additional data
      for (const [assetKey, stats] of assetStats) {
        if (stats.volume >= this.config.minVolume24h && stats.trades > 10) {
          const assetInfo = await this.enrichAssetInfo(assetKey, stats);
          if (assetInfo && this.meetsDiscoveryCriteria(assetInfo)) {
            discoveredAssets.push(assetInfo);
          }
        }
      }

    } catch (error) {
      this.logger.error('Failed to scan assets from Stellar network', error);
    }

    return discoveredAssets;
  }

  /**
   * Enrich asset information with TOML data and holder counts
   */
  private async enrichAssetInfo(assetKey: string, stats: any): Promise<DiscoveredAssetInfo | null> {
    try {
      const [assetType, assetCode, assetIssuer] = assetKey.split(':');

      if (assetType === 'native') {
        return {
          assetCode: 'XLM',
          assetType: 'NATIVE',
          tags: ['native', 'stellar'],
          liquidityScore: 10.0,
          volume24h: stats.volume,
          holdersCount: 0, // Native asset, everyone has it
          trustlinesCount: 0,
          lastActivity: stats.lastActivity,
        };
      }

      // Get asset details from Horizon
      const assetDetails = await this.getAssetDetails(assetCode, assetIssuer);
      if (!assetDetails) return null;

      // Get TOML information
      const tomlInfo = assetDetails.home_domain ? await this.fetchTomlInfo(assetDetails.home_domain) : null;

      // Extract tags from TOML or asset metadata
      const tags = this.extractTagsFromToml(tomlInfo, assetDetails);

      // Calculate liquidity score (0-10 scale)
      const liquidityScore = this.calculateLiquidityScore(stats, assetDetails);

      // Get holder/trustline counts
      const trustlinesCount = assetDetails.num_accounts || 0;

      return {
        assetCode,
        assetIssuer,
        assetType: assetType === 'credit_alphanum4' ? 'CREDIT_ALPHANUM4' : 'CREDIT_ALPHANUM12',
        homeDomain: assetDetails.home_domain,
        tomlInfo,
        tags,
        liquidityScore,
        volume24h: stats.volume,
        holdersCount: trustlinesCount,
        trustlinesCount,
        lastActivity: stats.lastActivity,
      };

    } catch (error) {
      this.logger.warn(`Failed to enrich asset info for ${assetKey}`, error);
      return null;
    }
  }

  /**
   * Check if asset meets discovery criteria
   */
  private meetsDiscoveryCriteria(asset: DiscoveredAssetInfo): boolean {
    // Must have minimum liquidity score
    if (asset.liquidityScore < this.config.minLiquidityScore) return false;

    // Must have minimum holders
    if (asset.holdersCount < this.config.minHoldersCount) return false;

    // Must have at least one required tag or be highly liquid
    const hasRequiredTag = this.config.requiredTags.some(tag =>
      asset.tags.some(assetTag => assetTag.toLowerCase().includes(tag.toLowerCase()))
    );

    return hasRequiredTag || asset.liquidityScore >= 9.0;
  }

  /**
   * Filter out assets that are already discovered or whitelisted
   */
  private async filterNewAssets(discoveredAssets: DiscoveredAssetInfo[]): Promise<DiscoveredAssetInfo[]> {
    const existingAssets = await this.prisma.discoveredAsset.findMany({
      where: {
        OR: discoveredAssets.map(asset => ({
          assetCode: asset.assetCode,
          assetIssuer: asset.assetIssuer || null,
        })),
      },
      select: {
        assetCode: true,
        assetIssuer: true,
      },
    });

    const existingKeys = new Set(
      existingAssets.map(asset => `${asset.assetCode}:${asset.assetIssuer || ''}`)
    );

    return discoveredAssets.filter(asset => {
      const key = `${asset.assetCode}:${asset.assetIssuer || ''}`;
      return !existingKeys.has(key);
    });
  }

  /**
   * Propose new assets for admin review
   */
  private async proposeAssetsForReview(assets: DiscoveredAssetInfo[]): Promise<DiscoveredAssetInfo[]> {
    const proposedAssets: DiscoveredAssetInfo[] = [];

    for (const asset of assets) {
      try {
        await this.prisma.discoveredAsset.create({
          data: {
            assetCode: asset.assetCode,
            assetIssuer: asset.assetIssuer,
            assetType: asset.assetType,
            homeDomain: asset.homeDomain,
            tomlInfo: asset.tomlInfo,
            tags: asset.tags,
            liquidityScore: asset.liquidityScore,
            volume24h: asset.volume24h,
            holdersCount: asset.holdersCount,
            trustlinesCount: asset.trustlinesCount,
            lastActivity: asset.lastActivity,
            status: 'DISCOVERED',
            proposedBy: 'asset-discovery-worker',
          },
        });

        proposedAssets.push(asset);
        this.logger.log(`Proposed new asset for review: ${asset.assetCode}:${asset.assetIssuer}`);
      } catch (error) {
        this.logger.warn(`Failed to propose asset ${asset.assetCode}:${asset.assetIssuer}`, error);
      }
    }

    return proposedAssets;
  }

  /**
   * Get pending assets for admin review
   */
  async getPendingAssets(limit: number = 50): Promise<any[]> {
    return this.prisma.discoveredAsset.findMany({
      where: {
        status: 'DISCOVERED',
      },
      orderBy: {
        liquidityScore: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Admin approves an asset for whitelisting
   */
  async approveAsset(assetId: string, adminId: string, category: string, riskLevel: string, reviewNotes?: string): Promise<void> {
    const asset = await this.prisma.discoveredAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Move to whitelisted assets
    await this.prisma.whitelistedAsset.create({
      data: {
        assetCode: asset.assetCode,
        assetIssuer: asset.assetIssuer,
        assetType: asset.assetType,
        homeDomain: asset.homeDomain,
        tomlInfo: asset.tomlInfo,
        tags: asset.tags,
        category: category as any,
        riskLevel: riskLevel as any,
        whitelistedBy: adminId,
        reviewNotes,
      },
    });

    // Update discovery status
    await this.prisma.discoveredAsset.update({
      where: { id: assetId },
      data: {
        status: 'WHITELISTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Asset ${asset.assetCode}:${asset.assetIssuer} whitelisted by admin ${adminId}`);
  }

  /**
   * Admin rejects an asset
   */
  async rejectAsset(assetId: string, adminId: string, reason: string): Promise<void> {
    await this.prisma.discoveredAsset.update({
      where: { id: assetId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });

    this.logger.log(`Asset ${assetId} rejected by admin ${adminId}: ${reason}`);
  }

  /**
   * Get discovered asset count
   */
  async getDiscoveredAssetCount(): Promise<number> {
    return this.prisma.discoveredAsset.count();
  }

  /**
   * Get pending asset count
   */
  async getPendingAssetCount(): Promise<number> {
    return this.prisma.discoveredAsset.count({
      where: { status: 'DISCOVERED' },
    });
  }

  /**
   * Get whitelisted asset list
   */
  async getWhitelistedAssetList(activeOnly: boolean = true): Promise<any[]> {
    return this.prisma.whitelistedAsset.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { whitelistedAt: 'desc' },
    });
  }

  /**
   * Get rejected asset count
   */
  async getRejectedAssetCount(): Promise<number> {
    return this.prisma.discoveredAsset.count({
      where: { status: 'REJECTED' },
    });
  }

  /**
   * Get last scan time
   */
  async getLastScanTime(): Promise<Date | undefined> {
    const lastAsset = await this.prisma.discoveredAsset.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return lastAsset?.createdAt;
  }

  /**
   * Get next scan time (24 hours from last scan)
   */
  async getNextScanTime(): Promise<Date | undefined> {
    const lastScan = await this.getLastScanTime();
    if (!lastScan) return undefined;

    return new Date(lastScan.getTime() + (this.config.scanIntervalHours * 60 * 60 * 1000));
  }

  /**
   * Get specific discovered asset
   */
  async getDiscoveredAsset(assetId: string): Promise<any> {
    const asset = await this.prisma.discoveredAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error('Discovered asset not found');
    }

    return asset;
  }

  /**
   * Get specific whitelisted asset
   */
  async getWhitelistedAsset(assetId: string): Promise<any> {
    const asset = await this.prisma.whitelistedAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error('Whitelisted asset not found');
    }

    return asset;
  }

  /**
   * Update whitelisted asset
   */
  async updateWhitelistedAsset(assetId: string, updates: any): Promise<void> {
    await this.prisma.whitelistedAsset.update({
      where: { id: assetId },
      data: {
        ...updates,
        lastReviewedAt: new Date(),
      },
    });
  }

  /**
   * Deactivate whitelisted asset
   */
  async deactivateWhitelistedAsset(assetId: string): Promise<void> {
    await this.prisma.whitelistedAsset.update({
      where: { id: assetId },
      data: {
        isActive: false,
        lastReviewedAt: new Date(),
      },
    });
  }

  /**
   * Get service configuration
   */
  getConfiguration(): AssetDiscoveryConfig {
    return this.config;
  }

  // Helper methods

  private getAssetKey(type: string, code?: string, issuer?: string): string {
    if (type === 'native') return 'native:XLM:';
    return `${type}:${code || ''}:${issuer || ''}`;
  }

  private async getAssetDetails(assetCode: string, assetIssuer: string): Promise<any> {
    try {
      const asset = await this.horizonServer.assets()
        .forCode(assetCode)
        .forIssuer(assetIssuer)
        .call();

      return asset.records[0] || null;
    } catch (error) {
      this.logger.warn(`Failed to get asset details for ${assetCode}:${assetIssuer}`, error);
      return null;
    }
  }

  private async fetchTomlInfo(homeDomain: string): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.homeDomainTimeout);

      const response = await fetch(`https://${homeDomain}/.well-known/stellar.toml`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const tomlText = await response.text();
      // Basic TOML parsing - in production, use a proper TOML parser
      return this.parseTomlBasic(tomlText);
    } catch (error) {
      this.logger.warn(`Failed to fetch TOML for ${homeDomain}`, error);
      return null;
    }
  }

  private extractTagsFromToml(tomlInfo: any, assetDetails: any): string[] {
    const tags: string[] = [];

    if (!tomlInfo) return tags;

    // Check for common tags in TOML
    if (tomlInfo.CURRENCIES) {
      for (const currency of tomlInfo.CURRENCIES) {
        if (currency.tags) {
          if (Array.isArray(currency.tags)) {
            tags.push(...currency.tags);
          } else if (typeof currency.tags === 'string') {
            tags.push(...currency.tags.split(',').map(t => t.trim()));
          }
        }
        if (currency.name?.toLowerCase().includes('stable') || currency.desc?.toLowerCase().includes('stable')) tags.push('Stable');
        if (currency.name?.toLowerCase().includes('rwa') || currency.desc?.toLowerCase().includes('rwa') || currency.desc?.toLowerCase().includes('real world')) tags.push('RWA');
      }
    }

    // Check asset description
    if (assetDetails.desc) {
      const desc = assetDetails.desc.toLowerCase();
      if (desc.includes('stable')) tags.push('Stable');
      if (desc.includes('rwa') || desc.includes('real world asset')) tags.push('RWA');
      if (desc.includes('defi') || desc.includes('decentralized')) tags.push('DeFi');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private calculateLiquidityScore(stats: any, assetDetails: any): number {
    let score = 0;

    // Volume score (0-4 points)
    const volumeScore = Math.min(4, Number(stats.volume) / 100000000000); // 10,000 XLM equivalent
    score += volumeScore;

    // Trade frequency score (0-3 points)
    const tradeScore = Math.min(3, stats.trades / 100);
    score += tradeScore;

    // Holder count score (0-3 points)
    const holderScore = Math.min(3, (assetDetails.num_accounts || 0) / 1000);
    score += holderScore;

    return Math.min(10, score);
  }

  private parseTomlBasic(tomlText: string): any {
    // Very basic TOML parser for essential fields
    const result: any = {};
    const lines = tomlText.split('\n');

    let currentSection = result;
    const sectionStack: any[] = [result];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Section headers
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const sectionName = trimmed.slice(1, -1);
        const sectionParts = sectionName.split('.');
        let current = result;

        for (const part of sectionParts) {
          if (!current[part]) current[part] = {};
          current = current[part];
        }

        currentSection = current;
        sectionStack.push(currentSection);
        continue;
      }

      // Key-value pairs
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex > 0) {
        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Parse arrays - keep as string for basic TOML parser
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim().replace(/"/g, '')).join(', ');
        }

        currentSection[key] = value;
      }
    }

    return result;
  }
}