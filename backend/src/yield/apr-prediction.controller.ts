import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { AprPredictionQueryDto } from './dto/apr-prediction.dto';

@ApiTags('APR Prediction')
@Controller('apr')
export class AprPredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get('predict')
  @ApiOperation({ 
    summary: 'Predict future APR with confidence intervals',
    description: 'Uses linear regression on historical yield data to predict next month\'s APR. Returns predicted value, confidence interval, and trend analysis.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'APR prediction successful',
    schema: {
      example: {
        success: true,
        data: {
          predictedValue: 12.5,
          confidenceInterval: {
            lower: 10.2,
            upper: 14.8,
            confidence: 0.95,
          },
          trend: 'increasing',
          accuracy: 0.87,
          dataPoints: 45,
        },
        message: 'APR prediction generated successfully',
      },
    },
  })
  async predictAPR(@Query() query: AprPredictionQueryDto) {
    const prediction = await this.predictionService.predictAPR(query.projectId);

    return {
      success: true,
      data: prediction,
      message: 'APR prediction generated successfully',
    };
  }

  @Get('predict/batch')
  @ApiOperation({ 
    summary: 'Predict APR for multiple projects',
    description: 'Returns predictions for all specified project IDs'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch APR predictions successful',
  })
  async predictAPRBatch(@Query('projectIds') projectIds: string) {
    const ids = projectIds.split(',');
    const predictions = await this.predictionService.predictAPRForProjects(ids);

    const result: Record<string, any> = {};
    predictions.forEach((value, key) => {
      result[key] = value;
    });

    return {
      success: true,
      data: result,
      count: predictions.size,
      message: `APR predictions generated for ${predictions.size} projects`,
    };
  }

  @Get('backtest')
  @ApiOperation({ 
    summary: 'Backtest prediction model accuracy',
    description: 'Validates the prediction model using historical data split into training and testing sets'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Backtest results',
    schema: {
      example: {
        success: true,
        data: {
          accuracy: 0.85,
          meanError: 1.2,
        },
        message: 'Model backtest completed',
      },
    },
  })
  async backtestModel() {
    const results = await this.predictionService.backtestModel();

    return {
      success: true,
      data: results,
      message: 'Model backtest completed',
    };
  }
}
