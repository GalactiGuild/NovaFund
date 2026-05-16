import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuditExporterService } from '../services/audit-exporter.service';
import { GenerateAuditPackageDto, AuditPackageResponseDto } from '../dto/audit-package.dto';
import { AdminGuard } from '../../guards/admin.guard';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditExporterService) {}

  /**
   * Generate a new audit package
   */
  @Post('generate')
  @Throttle({ default: { ttl: 3600_000, limit: 5 } }) // 5 packages per hour max
  async generateAuditPackage(
    @Body() dto: GenerateAuditPackageDto,
    @Req() req: any,
  ): Promise<AuditPackageResponseDto> {
    const options = {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    };

    const result = await this.auditService.generateAuditPackage(options, req.user.id);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        timestamp: result.metadata.timestamp.toISOString(),
        period: {
          startDate: result.metadata.period.startDate.toISOString(),
          endDate: result.metadata.period.endDate.toISOString(),
        },
      },
      downloadUrl: `/api/admin/audit/download/${result.packageId}`,
    };
  }

  /**
   * List available audit packages
   */
  @Get('packages')
  async listAuditPackages(
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const packages = await this.auditService.listAuditPackages(limitNum);

    return {
      packages: packages.map(pkg => ({
        packageId: pkg.packageId,
        timestamp: pkg.createdAt,
        period: pkg.metadata.period,
        recordCounts: pkg.metadata.recordCounts,
        generatedBy: pkg.adminId,
      })),
      total: packages.length,
    };
  }

  /**
   * Get audit package details
   */
  @Get('packages/:packageId')
  async getAuditPackage(@Param('packageId') packageId: string) {
    const packageInfo = await this.auditService.getAuditPackage(packageId);
    const isValid = await this.auditService.verifyPackageIntegrity(packageId);

    return {
      ...packageInfo,
      integrityVerified: isValid,
    };
  }

  /**
   * Download audit package
   */
  @Get('download/:packageId')
  async downloadAuditPackage(
    @Param('packageId') packageId: string,
    @Res() res: Response,
  ) {
    try {
      // Verify package exists and is valid
      const packageInfo = await this.auditService.getAuditPackage(packageId);
      const isValid = await this.auditService.verifyPackageIntegrity(packageId);

      if (!isValid) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Package integrity check failed',
        });
      }

      const filePath = `./audit-archives/${packageId}.audit.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${packageId}.audit.zip"`);
      res.setHeader('X-Package-ID', packageId);
      res.setHeader('X-Generated-At', packageInfo.createdAt);
      res.setHeader('X-Integrity-Verified', 'true');

      // Stream the file
      const { createReadStream } = require('fs');
      const stream = createReadStream(filePath);
      stream.pipe(res);

    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        error: 'Audit package not found',
      });
    }
  }

  /**
   * Verify package integrity
   */
  @Get('verify/:packageId')
  async verifyPackage(@Param('packageId') packageId: string) {
    const isValid = await this.auditService.verifyPackageIntegrity(packageId);

    return {
      packageId,
      integrityVerified: isValid,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get audit system status
   */
  @Get('status')
  async getAuditStatus() {
    const packages = await this.auditService.listAuditPackages(100);

    return {
      totalPackages: packages.length,
      latestPackage: packages[0] || null,
      systemStatus: 'operational',
      timestamp: new Date().toISOString(),
    };
  }
}