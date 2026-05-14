import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis/redis.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

export interface AuditPackageMetadata {
  id: string;
  timestamp: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  version: string;
  checksums: Record<string, string>;
  recordCounts: Record<string, number>;
  generatedBy: string;
}

export interface AuditPackageOptions {
  startDate?: Date;
  endDate?: Date;
  includeDatabaseSnapshot?: boolean;
  includeIpfsLogs?: boolean;
  includeBlockchainLogs?: boolean;
  includeKycHistory?: boolean;
  compressionLevel?: number;
  encryptionEnabled?: boolean;
}

@Injectable()
export class AuditExporterService {
  private readonly logger = new Logger(AuditExporterService.name);
  private readonly tempDir = '/tmp/novafund-audits';
  private readonly archiveDir = './audit-archives';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async generateAuditPackage(
    options: AuditPackageOptions = {},
    adminId: string,
  ): Promise<{ packageId: string; filePath: string; metadata: AuditPackageMetadata }> {
    const packageId = this.generatePackageId();
    const timestamp = new Date();

    const defaultOptions: Required<AuditPackageOptions> = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: timestamp,
      includeDatabaseSnapshot: true,
      includeIpfsLogs: true,
      includeBlockchainLogs: true,
      includeKycHistory: true,
      compressionLevel: 9,
      encryptionEnabled: true,
      ...options,
    };

    this.logger.log(`Starting audit package generation: ${packageId}`);

    try {
      const workDir = path.join(this.tempDir, packageId);
      await fs.mkdir(workDir, { recursive: true });

      const dataComponents = await this.generateDataComponents(workDir, defaultOptions);

      const metadata: AuditPackageMetadata = {
        id: packageId,
        timestamp,
        period: {
          startDate: defaultOptions.startDate,
          endDate: defaultOptions.endDate,
        },
        version: '1.0.0',
        checksums: dataComponents.checksums,
        recordCounts: dataComponents.recordCounts,
        generatedBy: adminId,
      };

      await fs.writeFile(
        path.join(workDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
      );

      const archivePath = await this.createSecureArchive(workDir, packageId, defaultOptions);
      const finalPath = await this.storeArchive(archivePath, packageId);
      await this.logAuditPackageCreation(packageId, metadata, adminId);

      this.logger.log(`Audit package generated successfully: ${packageId}`);

      return {
        packageId,
        filePath: finalPath,
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to generate audit package ${packageId}:`, error);
      throw error;
    } finally {
      try {
        await fs.rm(path.join(this.tempDir, packageId), { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp directory for ${packageId}:`, cleanupError);
      }
    }
  }

  private async generateDataComponents(
    workDir: string,
    options: Required<AuditPackageOptions>,
  ): Promise<{ checksums: Record<string, string>; recordCounts: Record<string, number> }> {
    const checksums: Record<string, string> = {};
    const recordCounts: Record<string, number> = {};

    if (options.includeDatabaseSnapshot) {
      const dbData = await this.generateDatabaseSnapshot(options.startDate, options.endDate);
      recordCounts.database = dbData.recordCount;
      const dbPath = path.join(workDir, 'database-snapshot.json');
      await fs.writeFile(dbPath, JSON.stringify(dbData.data, null, 2));
      checksums.database = await this.calculateFileChecksum(dbPath);
    }

    if (options.includeIpfsLogs) {
      const ipfsData = await this.generateIpfsLogs(options.startDate, options.endDate);
      recordCounts.ipfs = ipfsData.length;
      const ipfsPath = path.join(workDir, 'ipfs-logs.json');
      await fs.writeFile(ipfsPath, JSON.stringify(ipfsData, null, 2));
      checksums.ipfs = await this.calculateFileChecksum(ipfsPath);
    }

    if (options.includeBlockchainLogs) {
      const blockchainData = await this.generateBlockchainLogs(options.startDate, options.endDate);
      recordCounts.blockchain = blockchainData.length;
      const blockchainPath = path.join(workDir, 'blockchain-logs.json');
      await fs.writeFile(blockchainPath, JSON.stringify(blockchainData, null, 2));
      checksums.blockchain = await this.calculateFileChecksum(blockchainPath);
    }

    if (options.includeKycHistory) {
      const kycData = await this.generateKycHistory(options.startDate, options.endDate);
      recordCounts.kyc = kycData.length;
      const kycPath = path.join(workDir, 'kyc-history.json');
      await fs.writeFile(kycPath, JSON.stringify(kycData, null, 2));
      checksums.kyc = await this.calculateFileChecksum(kycPath);
    }

    return { checksums, recordCounts };
  }

  private async generateDatabaseSnapshot(
    startDate: Date,
    endDate: Date,
  ): Promise<{ data: any; recordCount: number }> {
    this.logger.debug('Generating database snapshot');

    const users = await this.prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        walletAddress: true,
        reputationScore: true,
        trustScore: true,
        createdAt: true,
        updatedAt: true,
        kycStatus: true,
        zkKycProvider: true,
        zkKycVerifiedAt: true,
        _count: {
          select: {
            createdProjects: true,
            contributions: true,
          },
        },
      },
    });

    const projects = await this.prisma.project.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const contributions = await this.prisma.contribution.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const kycAudits = [];

    const data = {
      users,
      projects,
      contributions,
      kycAudits,
      generatedAt: new Date(),
    };

    const recordCount = users.length + projects.length + contributions.length + kycAudits.length;

    return { data, recordCount };
  }

  private async generateIpfsLogs(startDate: Date, endDate: Date): Promise<any[]> {
    this.logger.debug('Generating IPFS logs');

    const ipfsOperations = await this.prisma.project.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ipfsHash: {
          not: null,
        },
      },
      select: {
        id: true,
        contractId: true,
        ipfsHash: true,
        createdAt: true,
        creatorId: true,
      },
    });

    return ipfsOperations.map(op => ({
      type: 'PROJECT_DOCUMENT',
      projectId: op.id,
      contractId: op.contractId,
      ipfsHash: op.ipfsHash,
      creatorId: op.creatorId,
      timestamp: op.createdAt,
    }));
  }

  private async generateBlockchainLogs(startDate: Date, endDate: Date): Promise<any[]> {
    this.logger.debug('Generating blockchain transaction logs');

    const contributions = await this.prisma.contribution.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            contractId: true,
            title: true,
          },
        },
      },
    });

    return contributions.map(contribution => ({
      transactionHash: contribution.transactionHash,
      type: 'CONTRIBUTION',
      projectId: contribution.project.id,
      contractId: contribution.project.contractId,
      investorId: contribution.investorId,
      amount: contribution.amount.toString(),
      timestamp: contribution.timestamp,
      blockchain: 'stellar',
      status: 'confirmed',
    }));
  }

  private async generateKycHistory(startDate: Date, endDate: Date): Promise<any[]> {
    this.logger.debug('Generating KYC history');

    const auditLogs = [];

    const userKycSummary = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            zkKycVerifiedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
      select: {
        id: true,
        walletAddress: true,
        kycStatus: true,
        zkKycProvider: true,
        zkKycVerifiedAt: true,
        createdAt: true,
      },
    });

    return [
      ...auditLogs.map(log => ({
        type: 'KYC_AUDIT_LOG',
        ...log,
      })),
      ...userKycSummary.map(user => ({
        type: 'KYC_USER_SUMMARY',
        userId: user.id,
        walletAddress: user.walletAddress,
        kycStatus: user.kycStatus,
        provider: user.zkKycProvider,
        verifiedAt: user.zkKycVerifiedAt,
        createdAt: user.createdAt,
      })),
    ];
  }

  private async createSecureArchive(
    workDir: string,
    packageId: string,
    options: Required<AuditPackageOptions>,
  ): Promise<string> {
    const archivePath = path.join(this.tempDir, `${packageId}.audit.zip`);

    const output = createWriteStream(archivePath);
    const archive = archiver('zip', {
      zlib: { level: options.compressionLevel },
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(archivePath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(workDir, false);

      const manifest = {
        packageId,
        createdAt: new Date(),
        encryptionEnabled: options.encryptionEnabled,
        checksumAlgorithm: 'sha256',
        version: '1.0.0',
      };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'security-manifest.json' });

      archive.finalize();
    });
  }

  private async storeArchive(archivePath: string, packageId: string): Promise<string> {
    await fs.mkdir(this.archiveDir, { recursive: true });

    const finalPath = path.join(this.archiveDir, `${packageId}.audit.zip`);

    await pipeline(
      createReadStream(archivePath),
      createWriteStream(finalPath),
    );

    const finalChecksum = await this.calculateFileChecksum(finalPath);

    await fs.writeFile(
      `${finalPath}.checksum`,
      `SHA256:${finalChecksum}`,
    );

    return finalPath;
  }

  private async logAuditPackageCreation(
    packageId: string,
    metadata: AuditPackageMetadata,
    adminId: string,
  ): Promise<void> {
    const logKey = `audit:package:${packageId}`;
    await this.redis.set(logKey, JSON.stringify({
      packageId,
      metadata,
      adminId,
      createdAt: new Date(),
    }), 365 * 24 * 60 * 60);

    this.logger.log(`Audit package ${packageId} logged by admin ${adminId}`);
  }

  private generatePackageId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `audit_${timestamp}_${random}`;
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  async listAuditPackages(limit = 50): Promise<any[]> {
    // TODO: Implement Redis keys method
    return [];
  }

  async getAuditPackage(packageId: string): Promise<any> {
    const logKey = `audit:package:${packageId}`;
    const data = await this.redis.get(logKey);

    if (!data) {
      throw new Error(`Audit package ${packageId} not found`);
    }

    return JSON.parse(data as string);
  }

  async verifyPackageIntegrity(packageId: string): Promise<boolean> {
    const packageInfo = await this.getAuditPackage(packageId);
    const archivePath = path.join(this.archiveDir, `${packageId}.audit.zip`);

    try {
      const actualChecksum = await this.calculateFileChecksum(archivePath);
      const expectedChecksum = (await fs.readFile(`${archivePath}.checksum`, 'utf-8')).split(':')[1];

      return actualChecksum === expectedChecksum;
    } catch (error) {
      this.logger.error(`Failed to verify package ${packageId} integrity:`, error);
      return false;
    }
  }
}
