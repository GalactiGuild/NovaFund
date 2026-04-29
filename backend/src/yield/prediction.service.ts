import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface DataPoint {
  x: number;
  y: number;
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  equation: string;
}

export interface PredictionResult {
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  accuracy: number;
  dataPoints: number;
}

export interface MarketTrendData {
  timestamp: Date;
  value: number;
  source: string;
}

/**
 * Dynamic APR Prediction Service
 * 
 * Uses linear regression to predict future APR based on:
 * - Historical yield data
 * - Project performance trends
 * - Market conditions
 * 
 * Provides confidence intervals for transparent yield expectations
 */
@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly predictionHorizon: number; // days
  private readonly confidenceLevel: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.predictionHorizon = this.configService.get<number>('APR_PREDICTION_HORIZON_DAYS', 30);
    this.confidenceLevel = this.configService.get<number>('APR_CONFIDENCE_LEVEL', 0.95);
  }

  /**
   * Predict next month's APR with confidence intervals
   * @param projectId Optional project ID for project-specific prediction
   * @returns Prediction result with confidence interval
   */
  async predictAPR(projectId?: string): Promise<PredictionResult> {
    try {
      // Step 1: Gather historical data
      const historicalData = await this.getHistoricalYieldData(projectId);
      
      if (historicalData.length < 7) {
        this.logger.warn('Insufficient data for prediction (need at least 7 data points)');
        return this.createFallbackResult(historicalData);
      }

      // Step 2: Perform linear regression
      const regression = this.performLinearRegression(historicalData);
      
      // Step 3: Fetch market trend data
      const marketTrend = await this.getMarketTrendData();
      
      // Step 4: Combine predictions (weighted average)
      const marketAdjustment = this.calculateMarketAdjustment(marketTrend);
      
      // Step 5: Predict future value
      const nextX = historicalData.length + this.predictionHorizon;
      const predictedValue = (regression.slope * nextX + regression.intercept) * marketAdjustment;
      
      // Step 6: Calculate confidence interval
      const confidenceInterval = this.calculateConfidenceInterval(
        historicalData,
        regression,
        predictedValue,
      );
      
      // Step 7: Determine trend
      const trend = this.determineTrend(regression.slope);
      
      const result: PredictionResult = {
        predictedValue: Math.max(0, predictedValue), // APR can't be negative
        confidenceInterval,
        trend,
        accuracy: regression.rSquared,
        dataPoints: historicalData.length,
      };

      this.logger.log(`APR prediction: ${result.predictedValue.toFixed(2)}% (trend: ${result.trend}, accuracy: ${(result.accuracy * 100).toFixed(1)}%)`);
      
      return result;
    } catch (error) {
      this.logger.error(`APR prediction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get historical yield data from database
   */
  private async getHistoricalYieldData(projectId?: string): Promise<DataPoint[]> {
    const days = 90; // Last 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let yieldEvents: any[];

    if (projectId) {
      // Project-specific data - need to join with escrow to get projectId
      yieldEvents = await this.prisma.$queryRaw`
        SELECT ye.id, ye.amount, ye.asset, ye.created_at
        FROM yield_events ye
        INNER JOIN escrows e ON ye.escrow_id = e.id
        WHERE e.project_id = ${projectId}
          AND ye.created_at >= ${startDate}
        ORDER BY ye.created_at ASC
      `;
    } else {
      // Aggregated platform data
      yieldEvents = await this.prisma.yieldEvent.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    // Convert to daily aggregated data points
    const dailyData = this.aggregateToDaily(yieldEvents);
    
    return dailyData.map((point, index) => ({
      x: index + 1,
      y: point.apr,
    }));
  }

  /**
   * Aggregate yield events to daily APR calculations
   */
  private aggregateToDaily(events: any[]): Array<{ date: Date; apr: number }> {
    const dailyMap = new Map<string, { total: number; count: number }>();

    for (const event of events) {
      const dateKey = event.createdAt.toISOString().split('T')[0];
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { total: 0, count: 0 });
      }
      
      const dayData = dailyMap.get(dateKey)!;
      dayData.total += Number(event.amount);
      dayData.count += 1;
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date),
        apr: data.count > 0 ? (data.total / data.count) * 100 : 0,
      }));
  }

  /**
   * Perform linear regression on data points
   * Returns slope, intercept, and R-squared value
   */
  private performLinearRegression(data: DataPoint[]): LinearRegressionResult {
    const n = data.length;
    
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (const point of data) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
      sumYY += point.y * point.y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    let ssTotal = 0;
    let ssResidual = 0;

    for (const point of data) {
      const yPredicted = slope * point.x + intercept;
      ssTotal += Math.pow(point.y - yMean, 2);
      ssResidual += Math.pow(point.y - yPredicted, 2);
    }

    const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

    return {
      slope,
      intercept,
      rSquared: Math.max(0, rSquared), // Ensure non-negative
      equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
    };
  }

  /**
   * Get market trend data from external sources or database
   * In production, this would fetch from crypto APIs, DeFi protocols, etc.
   */
  private async getMarketTrendData(): Promise<MarketTrendData[]> {
    // TODO: Integrate with external market data APIs
    // For now, return mock data or data from database if available
    
    try {
      // Check if we have market data in database
      const marketData: any = await this.prisma.$queryRaw`
        SELECT timestamp, value, source 
        FROM market_trends 
        WHERE timestamp >= NOW() - INTERVAL '30 days'
        ORDER BY timestamp ASC
      `;

      if (marketData && (marketData as any[]).length > 0) {
        return marketData as MarketTrendData[];
      }
    } catch (error) {
      this.logger.debug('No market trend data available');
    }

    // Return empty array - will use historical data only
    return [];
  }

  /**
   * Calculate market adjustment factor
   * Adjusts prediction based on market conditions
   */
  private calculateMarketAdjustment(marketData: MarketTrendData[]): number {
    if (marketData.length < 2) {
      return 1.0; // No adjustment if insufficient market data
    }

    // Calculate market trend (simple moving average comparison)
    const recent = marketData.slice(-7); // Last 7 days
    const older = marketData.slice(-14, -7); // Previous 7 days

    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;

    // Calculate trend percentage
    const trendPercent = (recentAvg - olderAvg) / olderAvg;

    // Convert to adjustment factor (dampen the effect)
    const adjustment = 1 + (trendPercent * 0.3); // 30% weight to market trend

    // Clamp between 0.8 and 1.2
    return Math.max(0.8, Math.min(1.2, adjustment));
  }

  /**
   * Calculate confidence interval for prediction
   * Uses standard error of the estimate
   */
  private calculateConfidenceInterval(
    data: DataPoint[],
    regression: LinearRegressionResult,
    predictedValue: number,
  ): PredictionResult['confidenceInterval'] {
    const n = data.length;
    
    // Calculate standard error
    let sumSquaredErrors = 0;
    for (const point of data) {
      const predicted = regression.slope * point.x + regression.intercept;
      sumSquaredErrors += Math.pow(point.y - predicted, 2);
    }
    
    const standardError = Math.sqrt(sumSquaredErrors / (n - 2));
    
    // T-value for confidence level (approximate for large n)
    const tValue = this.confidenceLevel === 0.95 ? 1.96 : 2.58; // 95% or 99%
    
    // Margin of error
    const marginOfError = tValue * standardError;
    
    return {
      lower: Math.max(0, predictedValue - marginOfError),
      upper: predictedValue + marginOfError,
      confidence: this.confidenceLevel,
    };
  }

  /**
   * Determine trend direction based on slope
   */
  private determineTrend(slope: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.01; // 1% threshold
    
    if (slope > threshold) {
      return 'increasing';
    } else if (slope < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Create fallback result when insufficient data
   */
  private createFallbackResult(data: DataPoint[]): PredictionResult {
    const avgYield = data.length > 0 
      ? data.reduce((sum, d) => sum + d.y, 0) / data.length 
      : 0;

    return {
      predictedValue: avgYield,
      confidenceInterval: {
        lower: avgYield * 0.8,
        upper: avgYield * 1.2,
        confidence: 0.5, // Low confidence
      },
      trend: 'stable',
      accuracy: 0,
      dataPoints: data.length,
    };
  }

  /**
   * Get prediction for multiple projects
   */
  async predictAPRForProjects(projectIds: string[]): Promise<Map<string, PredictionResult>> {
    const results = new Map<string, PredictionResult>();

    for (const projectId of projectIds) {
      try {
        const prediction = await this.predictAPR(projectId);
        results.set(projectId, prediction);
      } catch (error) {
        this.logger.error(`Failed to predict APR for project ${projectId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Validate prediction model accuracy using backtesting
   */
  async backtestModel(): Promise<{ accuracy: number; meanError: number }> {
    // Get last 60 days of data
    const historicalData = await this.getHistoricalYieldData();
    
    if (historicalData.length < 30) {
      return { accuracy: 0, meanError: 0 };
    }

    // Split into training (first 70%) and testing (last 30%)
    const splitIndex = Math.floor(historicalData.length * 0.7);
    const trainingData = historicalData.slice(0, splitIndex);
    const testingData = historicalData.slice(splitIndex);

    // Train model
    const regression = this.performLinearRegression(trainingData);

    // Test model
    let totalError = 0;
    let totalActual = 0;

    for (const point of testingData) {
      const predicted = regression.slope * point.x + regression.intercept;
      totalError += Math.abs(point.y - predicted);
      totalActual += point.y;
    }

    const meanError = totalError / testingData.length;
    const meanActual = totalActual / testingData.length;
    const accuracy = 1 - (meanError / meanActual);

    return {
      accuracy: Math.max(0, accuracy),
      meanError,
    };
  }
}
