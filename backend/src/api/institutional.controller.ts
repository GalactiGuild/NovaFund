import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminGuard } from '../guards/admin.guard';
import { PrismaService } from '../prisma.service';

type ReportFormat = 'json' | 'csv' | 'xml';

interface HoldingRow {
  projectId: string;
  projectName: string;
  invested: number;
  currentValue: number;
  unrealizedPnl: number;
  acquisitionDate: string;
}

@Controller('institutional')
@UseGuards(AdminGuard)
export class InstitutionalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /institutional/portfolio/:accountId
   * Full portfolio snapshot for a fund manager account.
   * Supports ?format=json|csv|xml
   */
  @Get('portfolio/:accountId')
  async getPortfolio(
    @Param('accountId') accountId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const holdings = await this.fetchHoldings(accountId);
    return this.sendReport(res, holdings, format, `portfolio_${accountId}`);
  }

  /**
   * GET /institutional/tax-loss-harvest/:accountId
   * Returns positions with unrealized losses suitable for tax-loss harvesting.
   */
  @Get('tax-loss-harvest/:accountId')
  async getTaxLossHarvest(
    @Param('accountId') accountId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const holdings = await this.fetchHoldings(accountId);
    const losses = holdings.filter((h) => h.unrealizedPnl < 0);
    return this.sendReport(res, losses, format, `tax_loss_${accountId}`);
  }

  /**
   * GET /institutional/bulk-accounting/:accountId
   * Aggregated accounting export for bulk reconciliation.
   */
  @Get('bulk-accounting/:accountId')
  async getBulkAccounting(
    @Param('accountId') accountId: string,
    @Query('format') format: ReportFormat = 'csv',
    @Res() res: Response,
  ) {
    const holdings = await this.fetchHoldings(accountId);
    return this.sendReport(res, holdings, format, `accounting_${accountId}`);
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private async fetchHoldings(accountId: string): Promise<HoldingRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        projectId: string;
        projectName: string;
        invested: number;
        currentValue: number;
        acquisitionDate: Date;
      }[]
    >`
      SELECT
        p.id            AS "projectId",
        p.name          AS "projectName",
        SUM(i.amount)   AS invested,
        SUM(i.amount * COALESCE(p."currentMultiplier", 1)) AS "currentValue",
        MIN(i."createdAt") AS "acquisitionDate"
      FROM "Investment" i
      JOIN "Project" p ON p.id = i."projectId"
      WHERE i."investorId" = ${accountId}
      GROUP BY p.id, p.name
      ORDER BY "acquisitionDate" ASC
    `;

    return rows.map((r) => ({
      projectId: r.projectId,
      projectName: r.projectName,
      invested: Number(r.invested),
      currentValue: Number(r.currentValue),
      unrealizedPnl: Number(r.currentValue) - Number(r.invested),
      acquisitionDate: new Date(r.acquisitionDate).toISOString().split('T')[0],
    }));
  }

  private sendReport(
    res: Response,
    data: HoldingRow[],
    format: ReportFormat,
    filename: string,
  ) {
    switch (format) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(this.toCsv(data));

      case 'xml':
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xml"`);
        return res.send(this.toXml(data));

      case 'json':
        return res.json({ accountReport: filename, generatedAt: new Date().toISOString(), data });

      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }

  private toCsv(rows: HoldingRow[]): string {
    const header = 'projectId,projectName,invested,currentValue,unrealizedPnl,acquisitionDate';
    const lines = rows.map(
      (r) =>
        `${r.projectId},"${r.projectName}",${r.invested},${r.currentValue},${r.unrealizedPnl},${r.acquisitionDate}`,
    );
    return [header, ...lines].join('\n');
  }

  private toXml(rows: HoldingRow[]): string {
    const items = rows
      .map(
        (r) => `  <holding>
    <projectId>${r.projectId}</projectId>
    <projectName>${r.projectName}</projectName>
    <invested>${r.invested}</invested>
    <currentValue>${r.currentValue}</currentValue>
    <unrealizedPnl>${r.unrealizedPnl}</unrealizedPnl>
    <acquisitionDate>${r.acquisitionDate}</acquisitionDate>
  </holding>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<portfolio>\n${items}\n</portfolio>`;
  }
}
