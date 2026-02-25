// ─────────────────────────────────────────────────────────────────────────────
// Risk Engine — Main Orchestrator
// Wires together: data pipeline → feature extraction → model → explainability
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RiskAssessmentResult,
  ProjectRawData,
  DataPipelineConfig,
} from "./types";
import { extractFeatures } from "./features";
import {
  predictSuccessProbability,
  computeRiskScore,
  classifyRiskLevel,
  DEFAULT_MODEL_CONFIG,
} from "./model";
import {
  getTopRiskFactors,
  getTopStrengths,
  generateExplanationSummary,
  generateInvestorInsights,
} from "./explainability";
import { aggregateProjectData } from "./data-pipeline";

const ENGINE_VERSION = "1.4.0";

export class RiskEngine {
  private config: DataPipelineConfig;

  constructor(config?: Partial<DataPipelineConfig>) {
    this.config = {
      cacheTtlMs: 5 * 60 * 1000,
      maxRetries: 3,
      timeoutMs: 8_000,
      privacyMode: false,
      ...config,
    };
  }

  /**
   * Full assessment pipeline for a project by ID.
   * Fetches data, extracts features, scores risk, explains output.
   */
  async assess(
    projectId: string,
    chainId = 1,
    contractAddress?: string,
  ): Promise<RiskAssessmentResult | null> {
    const { raw, errors, dataSourcesUsed } = await aggregateProjectData(
      projectId,
      chainId,
      contractAddress,
      this.config,
    );

    if (!raw) {
      console.error(
        `[RiskEngine] Could not fetch data for project ${projectId}:`,
        errors,
      );
      return null;
    }

    return this.assessFromRawData(raw, dataSourcesUsed);
  }

  /**
   * Assessment from pre-fetched raw data (e.g. for batch processing or testing).
   */
  assessFromRawData(
    raw: ProjectRawData,
    dataSourcesUsed: string[] = ["ON_CHAIN", "OFF_CHAIN"],
  ): RiskAssessmentResult {
    const features = extractFeatures(raw);
    const riskScore = computeRiskScore(features);
    const riskLevel = classifyRiskLevel(
      riskScore.overall,
      DEFAULT_MODEL_CONFIG,
    );
    const successPred = predictSuccessProbability(
      features,
      DEFAULT_MODEL_CONFIG,
    );
    const topRiskFactors = getTopRiskFactors(features, 5);
    const topStrengths = getTopStrengths(features, 5);
    const explanation = generateExplanationSummary(
      riskScore,
      topRiskFactors,
      topStrengths,
    );
    const insights = generateInvestorInsights(
      features,
      riskScore,
      topRiskFactors,
    );

    return {
      projectId: raw.offChain.projectId,
      timestamp: raw.timestamp,
      riskLevel,
      riskScore,
      successPrediction: successPred,
      topRiskFactors,
      topStrengths,
      explanationSummary: explanation,
      investorInsights: insights,
      dataSourcesUsed:
        dataSourcesUsed as RiskAssessmentResult["dataSourcesUsed"],
      assessmentVersion: ENGINE_VERSION,
    };
  }

  /**
   * Batch assess multiple projects in parallel (capped concurrency).
   */
  async assessBatch(
    projects: Array<{
      projectId: string;
      chainId?: number;
      contractAddress?: string;
    }>,
    concurrency = 5,
  ): Promise<Map<string, RiskAssessmentResult | null>> {
    const results = new Map<string, RiskAssessmentResult | null>();

    for (let i = 0; i < projects.length; i += concurrency) {
      const slice = projects.slice(i, i + concurrency);
      const batch = await Promise.allSettled(
        slice.map(({ projectId, chainId = 1, contractAddress }) =>
          this.assess(projectId, chainId, contractAddress),
        ),
      );

      batch.forEach((result, idx) => {
        const id = slice[idx].projectId;
        results.set(id, result.status === "fulfilled" ? result.value : null);
      });
    }

    return results;
  }
}

// ─── Re-exports for consumers ──────────────────────────────────────────────────

export type {
  RiskAssessmentResult,
  MonitoringSnapshot,
  RiskAlert,
} from "./types";
export { invalidateProjectCache } from "./data-pipeline";
