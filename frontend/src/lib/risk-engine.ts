// =============================================================================
// Algorithmic Risk Assessment Engine
// ML model for project success prediction with on-chain/off-chain data sources,
// risk scoring with explanations, and real-time monitoring capabilities.
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type ProjectCategory = "DEFI" | "NFT" | "GAMING" | "INFRASTRUCTURE" | "DAO" | "SOCIAL" | "OTHER";

export interface ProjectOnChainData {
  contractAddress?: string;
  chainId: number;
  totalRaised: number;
  contributorCount: number;
  largestContribution: number;
  fundingVelocity: number;       // USD per day
  daysActive: number;
  contractAuditScore?: number;   // 0–100
  hasMultisig: boolean;
  tokenomicsScore?: number;      // 0–100
  liquidityDepth?: number;
  onChainActivityScore: number;  // 0–100
}

export interface ProjectOffChainData {
  projectId: string;
  title: string;
  category: ProjectCategory;
  teamSize: number;
  teamExperienceYears: number;
  githubCommits?: number;
  githubStars?: number;
  githubContributors?: number;
  twitterFollowers?: number;
  discordMembers?: number;
  whitepaperScore: number;       // 0–100
  roadmapClarity: number;        // 0–100
  partnershipCount: number;
  advisorCount: number;
  advisorQualityScore: number;   // 0–100
  previousProjectsSuccessRate?: number; // 0–1
  legalComplianceScore: number;  // 0–100
  mediaScore: number;            // 0–100
  sentimentScore: number;        // -1 to 1
  fundingGoal: number;
  fundingDeadlineDays: number;
  milestoneCount: number;
  milestoneCompletionRate?: number; // 0–1
}

export interface ProjectRawData {
  onChain: ProjectOnChainData;
  offChain: ProjectOffChainData;
  timestamp: number;
}

export interface RiskScore {
  overall: number;
  fundingRisk: number;
  teamRisk: number;
  technicalRisk: number;
  communityRisk: number;
  marketRisk: number;
  legalRisk: number;
}

export interface RiskFactor {
  name: string;
  displayName: string;
  category: "FUNDING" | "TEAM" | "TECHNICAL" | "COMMUNITY" | "MARKET" | "LEGAL";
  impact: number;        // negative = hurts, positive = helps
  currentValue: number;  // 0–1
  benchmark: number;     // 0–1 (successful project average)
  description: string;
  recommendation: string;
}

export interface SuccessPrediction {
  probability: number;
  confidenceInterval: [number, number];
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface RiskAssessmentResult {
  projectId: string;
  timestamp: number;
  riskLevel: RiskLevel;
  riskScore: RiskScore;
  successPrediction: SuccessPrediction;
  topRiskFactors: RiskFactor[];
  topStrengths: RiskFactor[];
  explanationSummary: string;
  investorInsights: string[];
}

export interface RiskAlert {
  id: string;
  projectId: string;
  timestamp: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  type: string;
  message: string;
  previousScore: number;
  currentScore: number;
}

export interface MonitoringSnapshot {
  projectId: string;
  timestamp: number;
  riskScore: number;
  riskLevel: RiskLevel;
  alerts: RiskAlert[];
  deltaFromPrevious?: number;
  trendDirection: "IMPROVING" | "DECLINING" | "STABLE";
}

// ─── Feature Engineering ──────────────────────────────────────────────────────

const CATEGORY_RISK: Record<ProjectCategory, number> = {
  INFRASTRUCTURE: 0.20, DEFI: 0.45, DAO: 0.40,
  GAMING: 0.55, NFT: 0.70, SOCIAL: 0.50, OTHER: 0.60,
};

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function logNorm(value: number, reference: number): number {
  if (value <= 0) return 0;
  return clamp(Math.log1p(value) / Math.log1p(reference));
}

interface FeatureVector {
  fundingCompletionRate: number;
  fundingVelocityNorm: number;
  daysRemainingRatio: number;
  whaleConcentration: number;
  teamStrength: number;
  teamExperience: number;
  prevSuccessBoost: number;
  communityEngagement: number;
  sentimentNorm: number;
  githubActivity: number;
  socialReach: number;
  contractSecurity: number;
  auditSafety: number;
  techRobustness: number;
  projectQuality: number;
  roadmapScore: number;
  legalRisk: number;
  liquidityRisk: number;
  categoryRisk: number;
  earlyMomentum: number;
  whitepaperQuality: number;
  advisoryStrength: number;
}

function extractFeatures(raw: ProjectRawData): FeatureVector {
  const { onChain: oc, offChain: off } = raw;

  const fundingCompletionRate = clamp(oc.totalRaised / (off.fundingGoal || 1));
  const daysRemaining = Math.max(0, off.fundingDeadlineDays - oc.daysActive);
  const daysRemainingRatio = off.fundingDeadlineDays > 0
    ? clamp(daysRemaining / off.fundingDeadlineDays) : 0;
  const fundingVelocityNorm = logNorm(oc.fundingVelocity, 5000);
  const whaleConcentration = clamp(oc.largestContribution / (oc.totalRaised || 1));

  const teamExperience = logNorm(off.teamExperienceYears, 5);
  const prevSuccessBoost = off.previousProjectsSuccessRate ?? 0.4;
  const advisoryStrength = clamp(
    0.5 * clamp(off.advisorCount / 3) + 0.5 * clamp(off.advisorQualityScore / 100)
  );
  const teamStrength = clamp(
    0.3 * teamExperience + 0.25 * prevSuccessBoost +
    0.25 * clamp(off.teamSize / 10) + 0.20 * advisoryStrength
  );

  const twitterScore  = logNorm(off.twitterFollowers ?? 0, 10000);
  const discordScore  = logNorm(off.discordMembers   ?? 0, 5000);
  const sentimentNorm = clamp((off.sentimentScore + 1) / 2);
  const communityEngagement = clamp(0.35 * twitterScore + 0.35 * discordScore + 0.30 * sentimentNorm);
  const socialReach   = clamp(0.6 * twitterScore + 0.4 * discordScore);
  const githubActivity = clamp(
    0.5 * logNorm(off.githubCommits ?? 0, 200) +
    0.3 * logNorm(off.githubContributors ?? 0, 20) +
    0.2 * logNorm(off.githubStars ?? 0, 500)
  );

  const auditSafety = oc.contractAuditScore != null ? clamp(oc.contractAuditScore / 100) : 0.3;
  const contractSecurity = clamp(0.6 * auditSafety + 0.4 * (oc.hasMultisig ? 1 : 0));
  const techRobustness = clamp(
    0.4 * contractSecurity + 0.3 * githubActivity +
    0.3 * clamp((oc.tokenomicsScore ?? 40) / 100)
  );

  const whitepaperQuality = clamp(off.whitepaperScore / 100);
  const roadmapScore = clamp(off.roadmapClarity / 100);
  const legalRisk    = 1 - clamp(off.legalComplianceScore / 100);
  const projectQuality = clamp(
    0.25 * whitepaperQuality + 0.20 * roadmapScore + 0.20 * advisoryStrength +
    0.15 * clamp(off.partnershipCount / 3) + 0.10 * clamp(off.mediaScore / 100) +
    0.10 * clamp(off.milestoneCount / 10)
  );

  const liquidityRisk = 1 - (oc.liquidityDepth != null ? logNorm(oc.liquidityDepth, 500000) : 0.2);
  const categoryRisk  = CATEGORY_RISK[off.category] ?? 0.5;

  const earlyMomentum = clamp(
    0.35 * fundingCompletionRate + 0.25 * fundingVelocityNorm +
    0.20 * communityEngagement + 0.20 * clamp(oc.contributorCount / 500)
  );

  return {
    fundingCompletionRate, fundingVelocityNorm, daysRemainingRatio, whaleConcentration,
    teamStrength, teamExperience, prevSuccessBoost, communityEngagement, sentimentNorm,
    githubActivity, socialReach, contractSecurity, auditSafety, techRobustness,
    projectQuality, roadmapScore, legalRisk, liquidityRisk, categoryRisk,
    earlyMomentum, whitepaperQuality, advisoryStrength,
  };
}

// ─── ML Model (Ensemble: Logistic Regression + GBDT + Random Forest) ─────────

const LR_WEIGHTS: Record<keyof FeatureVector, number> = {
  fundingCompletionRate:  0.18,  fundingVelocityNorm:   0.12,
  earlyMomentum:          0.14,  daysRemainingRatio:    0.05,
  whaleConcentration:    -0.10,  teamStrength:          0.13,
  teamExperience:         0.07,  prevSuccessBoost:      0.09,
  advisoryStrength:       0.06,  communityEngagement:   0.10,
  sentimentNorm:          0.08,  githubActivity:        0.07,
  socialReach:            0.04,  techRobustness:        0.11,
  auditSafety:            0.09,  contractSecurity:      0.10,
  projectQuality:         0.10,  roadmapScore:          0.07,
  whitepaperQuality:      0.06,  legalRisk:            -0.09,
  liquidityRisk:         -0.06,  categoryRisk:         -0.05,
};

type TreeNode = { f: keyof FeatureVector; t: number; l: number | TreeNode; r: number | TreeNode };

function evalTree(node: number | TreeNode, fv: FeatureVector): number {
  if (typeof node === "number") return node;
  return (fv[node.f] ?? 0) <= node.t ? evalTree(node.l, fv) : evalTree(node.r, fv);
}

const GBDT_TREES: TreeNode[] = [
  { f: "fundingCompletionRate", t: 0.5,
    l: { f: "earlyMomentum",    t: 0.3, l: -0.12, r:  0.04 },
    r: { f: "fundingVelocityNorm", t: 0.6, l: 0.08, r: 0.18 } },
  { f: "teamStrength", t: 0.5,
    l: { f: "prevSuccessBoost", t: 0.5, l: -0.10, r:  0.02 },
    r: { f: "advisoryStrength", t: 0.4, l:  0.06, r:  0.14 } },
  { f: "contractSecurity", t: 0.5,
    l: { f: "auditSafety",     t: 0.3, l: -0.15, r: -0.03 },
    r: { f: "techRobustness",  t: 0.6, l:  0.05, r:  0.12 } },
  { f: "sentimentNorm", t: 0.45,
    l: { f: "communityEngagement", t: 0.3, l: -0.08, r: -0.02 },
    r: { f: "socialReach",         t: 0.5, l:  0.04, r:  0.10 } },
  { f: "legalRisk", t: 0.5,
    l: { f: "liquidityRisk",       t: 0.6, l:  0.06, r: -0.02 },
    r: { f: "whaleConcentration",  t: 0.4, l: -0.04, r: -0.13 } },
];

const RF_TREES: Array<{ features: Array<keyof FeatureVector>; weights: number[] }> = [
  { features: ["fundingCompletionRate", "earlyMomentum",      "teamStrength"],    weights: [0.45, 0.35, 0.20] },
  { features: ["communityEngagement",   "githubActivity",     "sentimentNorm"],   weights: [0.40, 0.35, 0.25] },
  { features: ["contractSecurity",      "techRobustness",     "auditSafety"],     weights: [0.40, 0.35, 0.25] },
  { features: ["projectQuality",        "roadmapScore",       "advisoryStrength"],weights: [0.40, 0.30, 0.30] },
  { features: ["teamExperience",        "prevSuccessBoost",   "socialReach"],     weights: [0.35, 0.40, 0.25] },
];

function runLogisticRegression(fv: FeatureVector): number {
  let logit = -0.5;
  (Object.keys(LR_WEIGHTS) as Array<keyof FeatureVector>).forEach((k) => {
    logit += LR_WEIGHTS[k] * (fv[k] ?? 0);
  });
  return 1 / (1 + Math.exp(-logit * 4));
}

function runGBDT(fv: FeatureVector): number {
  return clamp(0.5 + 0.1 * GBDT_TREES.reduce((sum, tree) => sum + evalTree(tree, fv), 0));
}

function runRandomForest(fv: FeatureVector): number {
  const preds = RF_TREES.map(({ features, weights }) => {
    return clamp(features.reduce((sum, f, i) => sum + (fv[f] ?? 0) * weights[i], 0));
  });
  return preds.reduce((a, b) => a + b, 0) / preds.length;
}

function predictSuccessProbability(fv: FeatureVector): SuccessPrediction {
  const lr  = runLogisticRegression(fv);
  const gb  = runGBDT(fv);
  const rf  = runRandomForest(fv);
  const prob = 0.35 * lr + 0.45 * gb + 0.20 * rf;

  const variance =
    0.35 * Math.pow(lr - prob, 2) +
    0.45 * Math.pow(gb - prob, 2) +
    0.20 * Math.pow(rf - prob, 2);
  const std = Math.sqrt(variance);
  const margin = 1.96 * std;

  return {
    probability: Math.round(prob * 1000) / 1000,
    confidenceInterval: [
      Math.round(Math.max(0, prob - margin) * 1000) / 1000,
      Math.round(Math.min(1, prob + margin) * 1000) / 1000,
    ],
    confidenceLevel: std < 0.05 ? "HIGH" : std < 0.12 ? "MEDIUM" : "LOW",
  };
}

function computeRiskScore(fv: FeatureVector): RiskScore {
  const fundingRisk = Math.round(100 * (
    0.40 * fv.fundingCompletionRate + 0.25 * fv.fundingVelocityNorm +
    0.20 * (1 - fv.whaleConcentration) + 0.15 * fv.earlyMomentum
  ));
  const teamRisk = Math.round(100 * (
    0.35 * fv.teamStrength + 0.25 * fv.teamExperience +
    0.25 * fv.prevSuccessBoost + 0.15 * fv.advisoryStrength
  ));
  const technicalRisk = Math.round(100 * (
    0.35 * fv.contractSecurity + 0.30 * fv.techRobustness +
    0.20 * fv.auditSafety + 0.15 * fv.githubActivity
  ));
  const communityRisk = Math.round(100 * (
    0.35 * fv.communityEngagement + 0.30 * fv.sentimentNorm +
    0.20 * fv.socialReach + 0.15 * fv.githubActivity
  ));
  const marketRisk = Math.round(100 * (
    0.40 * (1 - fv.liquidityRisk) + 0.35 * (1 - fv.categoryRisk) +
    0.25 * fv.earlyMomentum
  ));
  const legalRisk = Math.round(100 * (1 - fv.legalRisk));
  const overall = Math.round(
    0.20 * fundingRisk + 0.18 * teamRisk + 0.18 * technicalRisk +
    0.14 * communityRisk + 0.16 * marketRisk + 0.14 * legalRisk
  );
  return { overall, fundingRisk, teamRisk, technicalRisk, communityRisk, marketRisk, legalRisk };
}

function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "VERY_LOW";
  if (score >= 65) return "LOW";
  if (score >= 45) return "MEDIUM";
  if (score >= 25) return "HIGH";
  return "VERY_HIGH";
}

// ─── Explainability (SHAP-inspired) ──────────────────────────────────────────

const BASELINES: FeatureVector = {
  fundingCompletionRate: 0.40, fundingVelocityNorm: 0.35, daysRemainingRatio: 0.50,
  whaleConcentration: 0.25, teamStrength: 0.50, teamExperience: 0.40,
  prevSuccessBoost: 0.40, communityEngagement: 0.40, sentimentNorm: 0.55,
  githubActivity: 0.35, socialReach: 0.35, techRobustness: 0.45,
  auditSafety: 0.30, contractSecurity: 0.40, projectQuality: 0.45,
  roadmapScore: 0.50, legalRisk: 0.30, liquidityRisk: 0.50,
  categoryRisk: 0.50, earlyMomentum: 0.40, whitepaperQuality: 0.45,
  advisoryStrength: 0.40,
};

const FACTOR_DEFINITIONS: Array<{
  key: keyof FeatureVector;
  displayName: string;
  category: RiskFactor["category"];
  benchmark: number;
  describe: (v: number) => string;
  recommend: (v: number) => string;
}> = [
  {
    key: "fundingCompletionRate", displayName: "Funding Progress", category: "FUNDING",
    benchmark: 0.80,
    describe: (v) => `Project has raised ${Math.round(v * 100)}% of its funding goal.`,
    recommend: (v) => v < 0.3
      ? "Funding traction is low — improve marketing or adjust the funding goal."
      : v < 0.6 ? "Moderate progress. Stronger community outreach may accelerate momentum."
      : "Strong funding progress. Maintain current momentum.",
  },
  {
    key: "earlyMomentum", displayName: "Early Momentum", category: "FUNDING",
    benchmark: 0.70,
    describe: (v) => `Early traction composite score: ${Math.round(v * 100)}/100.`,
    recommend: (v) => v < 0.4
      ? "Weak early momentum — strategic partnerships and high-impact launch events may help."
      : "Momentum is adequate. Convert community interest into contributions.",
  },
  {
    key: "whaleConcentration", displayName: "Whale Concentration Risk", category: "FUNDING",
    benchmark: 0.15,
    describe: (v) => `${Math.round(v * 100)}% of funds from the single largest contributor.`,
    recommend: (v) => v > 0.3
      ? "High whale risk — consider setting max contribution caps to diversify."
      : "Concentration risk is acceptable.",
  },
  {
    key: "teamStrength", displayName: "Team Quality", category: "TEAM",
    benchmark: 0.75,
    describe: (v) => `Team composite score: ${Math.round(v * 100)}/100.`,
    recommend: (v) => v < 0.5
      ? "Below-average team score — add experienced advisors or publicise credentials."
      : "Team appears solid. Highlight individual credentials to build investor confidence.",
  },
  {
    key: "prevSuccessBoost", displayName: "Founders' Track Record", category: "TEAM",
    benchmark: 0.65,
    describe: (v) => `Founders' historical project success rate: ${Math.round(v * 100)}%.`,
    recommend: (v) => v < 0.4
      ? "Limited prior history. A detailed execution roadmap can compensate."
      : "Good track record — strong positive signal for investors.",
  },
  {
    key: "contractSecurity", displayName: "Smart Contract Security", category: "TECHNICAL",
    benchmark: 0.80,
    describe: (v) => `Contract security score: ${Math.round(v * 100)}/100 (audit + multisig).`,
    recommend: (v) => v < 0.5
      ? "Security is concerning — a third-party audit is strongly recommended."
      : v < 0.75 ? "Moderate security. Consider a reputable audit firm."
      : "Strong security posture.",
  },
  {
    key: "auditSafety", displayName: "Audit Status", category: "TECHNICAL",
    benchmark: 0.75,
    describe: (v) => v < 0.35 ? "No audit or low-quality audit detected."
      : `Audit score: ${Math.round(v * 100)}/100.`,
    recommend: (v) => v < 0.35
      ? "Critical: unaudited contracts dramatically increase investor risk."
      : "Audit coverage adequate — ensure reports are publicly accessible.",
  },
  {
    key: "communityEngagement", displayName: "Community Engagement", category: "COMMUNITY",
    benchmark: 0.70,
    describe: (v) => `Community activity score: ${Math.round(v * 100)}/100.`,
    recommend: (v) => v < 0.4
      ? "Low engagement — regular AMAs and Discord activity can help."
      : "Community engagement is healthy.",
  },
  {
    key: "sentimentNorm", displayName: "Community Sentiment", category: "COMMUNITY",
    benchmark: 0.65,
    describe: (v) => v < 0.4 ? "Community sentiment is predominantly negative."
      : v < 0.6 ? "Community sentiment is neutral."
      : `Community sentiment is positive (${Math.round(v * 100)}/100).`,
    recommend: (v) => v < 0.4
      ? "Negative sentiment detected — address community concerns transparently."
      : "Sentiment is positive. Sustain open communication channels.",
  },
  {
    key: "legalRisk", displayName: "Legal & Compliance Risk", category: "LEGAL",
    benchmark: 0.15,
    describe: (v) => `Legal risk score: ${Math.round(v * 100)}/100 (higher = riskier).`,
    recommend: (v) => v > 0.5
      ? "Significant compliance gaps — engage legal counsel specialising in crypto regulation."
      : v > 0.3 ? "Moderate risk — review jurisdiction-specific requirements."
      : "Legal posture appears sound.",
  },
  {
    key: "liquidityRisk", displayName: "Liquidity Risk", category: "MARKET",
    benchmark: 0.30,
    describe: (v) => `Liquidity risk: ${Math.round(v * 100)}/100. Low liquidity increases exit difficulty.`,
    recommend: (v) => v > 0.6
      ? "Low liquidity is a concern for secondary exits — consider liquidity mining."
      : "Liquidity appears adequate.",
  },
  {
    key: "projectQuality", displayName: "Project Fundamentals", category: "MARKET",
    benchmark: 0.70,
    describe: (v) => `Overall project quality: ${Math.round(v * 100)}/100.`,
    recommend: (v) => v < 0.5
      ? "Weak fundamentals — improve whitepaper, roadmap, and partnerships."
      : "Strong project fundamentals.",
  },
];

function computeExplainability(fv: FeatureVector): { risks: RiskFactor[]; strengths: RiskFactor[] } {
  const factors = FACTOR_DEFINITIONS.map(({ key, displayName, category, benchmark, describe, recommend }) => {
    const value = fv[key];
    const baselineVal = BASELINES[key] ?? 0.5;
    const weight = Math.abs(LR_WEIGHTS[key] ?? 0);
    const impact = weight * (value - baselineVal);

    return {
      name: key,
      displayName,
      category,
      impact,
      currentValue: value,
      benchmark,
      description: describe(value),
      recommendation: recommend(value),
    } satisfies RiskFactor;
  });

  const risks     = factors.filter((f) => f.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, 5);
  const strengths = factors.filter((f) => f.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 5);
  return { risks, strengths };
}

function buildExplanationSummary(score: RiskScore, risks: RiskFactor[], strengths: RiskFactor[]): string {
  const riskWord =
    score.overall >= 80 ? "very low risk" :
    score.overall >= 65 ? "low risk" :
    score.overall >= 45 ? "moderate risk" :
    score.overall >= 25 ? "high risk" : "very high risk";

  const weakest =
    Math.min(score.fundingRisk, score.teamRisk, score.technicalRisk) === score.fundingRisk
      ? "funding momentum"
      : Math.min(score.fundingRisk, score.teamRisk, score.technicalRisk) === score.teamRisk
      ? "team quality" : "technical robustness";

  return (
    `This project is assessed as ${riskWord} (score: ${score.overall}/100). ` +
    `The primary concern is ${(risks[0]?.displayName ?? "unknown").toLowerCase()}, ` +
    `while ${(strengths[0]?.displayName ?? "team quality").toLowerCase()} is the strongest signal. ` +
    `The weakest domain is ${weakest}. ` +
    `Investors should weigh the identified risk factors carefully before committing capital.`
  );
}

function buildInvestorInsights(fv: FeatureVector, score: RiskScore, risks: RiskFactor[]): string[] {
  const insights: string[] = [];
  if (score.fundingRisk < 50)
    insights.push("Funding velocity is below target — project may not reach its goal within the deadline.");
  if (fv.whaleConcentration > 0.35)
    insights.push(`Whale risk: top contributor holds ${Math.round(fv.whaleConcentration * 100)}% of funds. Consider a max contribution cap.`);
  if (fv.auditSafety < 0.35)
    insights.push("Smart contracts are unaudited — significant security risk for investors.");
  if (fv.sentimentNorm < 0.45)
    insights.push("Community sentiment is trending negative. Monitor Discord and Twitter for grievances.");
  if (fv.legalRisk > 0.5)
    insights.push("Elevated regulatory risk. Confirm the project has appropriate legal opinions.");
  if (fv.teamStrength > 0.7 && fv.projectQuality > 0.65)
    insights.push("Strong team and solid project fundamentals — a positive signal for long-term viability.");
  if (score.overall >= 70)
    insights.push("Overall risk profile is favourable. This project meets baseline quality thresholds.");
  risks.slice(0, 2).forEach((r) => insights.push(r.recommendation));
  return insights.slice(0, 6);
}

// ─── Data Pipeline ────────────────────────────────────────────────────────────

const _cache = new Map<string, { data: unknown; expiresAt: number }>();

async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.data as T;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await fetcher();
      _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

export async function fetchProjectData(
  projectId: string,
  chainId = 1,
): Promise<ProjectRawData | null> {
  try {
    const [onChainRes, offChainRes] = await Promise.allSettled([
      fetchWithCache<ProjectOnChainData>(
        `on:${projectId}:${chainId}`,
        5 * 60_000,
        async () => {
          const res = await fetch(`/api/projects/${projectId}/on-chain?chainId=${chainId}`);
          if (!res.ok) throw new Error(`On-chain API ${res.status}`);
          return res.json() as Promise<ProjectOnChainData>;
        },
      ),
      fetchWithCache<ProjectOffChainData>(
        `off:${projectId}`,
        5 * 60_000,
        async () => {
          const res = await fetch(`/api/projects/${projectId}/details`);
          if (!res.ok) throw new Error(`Off-chain API ${res.status}`);
          return res.json() as Promise<ProjectOffChainData>;
        },
      ),
    ]);

    if (onChainRes.status === "rejected" || offChainRes.status === "rejected") return null;

    return { onChain: onChainRes.value, offChain: offChainRes.value, timestamp: Date.now() };
  } catch {
    return null;
  }
}

export function invalidateCache(projectId: string): void {
  _cache.delete(`off:${projectId}`);
  Array.from(_cache.keys())
    .filter((k) => k.startsWith(`on:${projectId}:`))
    .forEach((k) => _cache.delete(k));
}

// ─── Main Assessment Entry Point ──────────────────────────────────────────────

export async function assessProject(
  projectId: string,
  chainId = 1,
): Promise<RiskAssessmentResult | null> {
  const raw = await fetchProjectData(projectId, chainId);
  if (!raw) return null;
  return assessFromRawData(raw);
}

export function assessFromRawData(raw: ProjectRawData): RiskAssessmentResult {
  const fv          = extractFeatures(raw);
  const riskScore   = computeRiskScore(fv);
  const riskLevel   = classifyRiskLevel(riskScore.overall);
  const prediction  = predictSuccessProbability(fv);
  const { risks, strengths } = computeExplainability(fv);
  const summary     = buildExplanationSummary(riskScore, risks, strengths);
  const insights    = buildInvestorInsights(fv, riskScore, risks);

  return {
    projectId:          raw.offChain.projectId,
    timestamp:          raw.timestamp,
    riskLevel,
    riskScore,
    successPrediction:  prediction,
    topRiskFactors:     risks,
    topStrengths:       strengths,
    explanationSummary: summary,
    investorInsights:   insights,
  };
}

// ─── Real-Time Risk Monitor ───────────────────────────────────────────────────

type AlertHandler    = (alert: RiskAlert)          => void;
type SnapshotHandler = (snapshot: MonitoringSnapshot) => void;

interface MonitorSession {
  projectId:        string;
  intervalMs:       number;
  snapshots:        MonitoringSnapshot[];
  handle:           ReturnType<typeof setInterval> | null;
  alertHandlers:    Set<AlertHandler>;
  snapshotHandlers: Set<SnapshotHandler>;
}

const _sessions = new Map<string, MonitorSession>();

function detectTrend(snapshots: MonitoringSnapshot[]): MonitoringSnapshot["trendDirection"] {
  if (snapshots.length < 3) return "STABLE";
  const recent = snapshots.slice(-5);
  const delta  = recent[recent.length - 1].riskScore - recent[0].riskScore;
  if (Math.abs(delta) < 2) return "STABLE";
  return delta > 0 ? "IMPROVING" : "DECLINING";
}

async function runPoll(projectId: string): Promise<void> {
  const session = _sessions.get(projectId);
  if (!session) return;

  invalidateCache(projectId);
  const result = await assessProject(projectId);
  if (!result) return;

  const prev     = session.snapshots[session.snapshots.length - 1];
  const prevScore = prev?.riskScore ?? result.riskScore.overall;
  const delta    = result.riskScore.overall - prevScore;
  const alerts:   RiskAlert[] = [];
  const now       = Date.now();

  if (delta <= -10) {
    alerts.push({
      id: `${projectId}-drop-${now}`, projectId, timestamp: now, severity: "CRITICAL",
      type: "SCORE_DROP",
      message: `Risk score dropped ${Math.abs(delta).toFixed(1)} pts (${prevScore} → ${result.riskScore.overall}). Immediate review recommended.`,
      previousScore: prevScore, currentScore: result.riskScore.overall,
    });
  } else if (delta <= -5) {
    alerts.push({
      id: `${projectId}-warn-${now}`, projectId, timestamp: now, severity: "WARNING",
      type: "SCORE_DROP",
      message: `Risk score declined ${Math.abs(delta).toFixed(1)} pts (${prevScore} → ${result.riskScore.overall}).`,
      previousScore: prevScore, currentScore: result.riskScore.overall,
    });
  } else if (delta >= 10) {
    alerts.push({
      id: `${projectId}-improve-${now}`, projectId, timestamp: now, severity: "INFO",
      type: "SCORE_IMPROVEMENT",
      message: `Risk score improved ${delta.toFixed(1)} pts (${prevScore} → ${result.riskScore.overall}).`,
      previousScore: prevScore, currentScore: result.riskScore.overall,
    });
  }

  const snapshot: MonitoringSnapshot = {
    projectId,
    timestamp:         now,
    riskScore:         result.riskScore.overall,
    riskLevel:         result.riskLevel,
    alerts,
    deltaFromPrevious: delta,
    trendDirection:    detectTrend(session.snapshots),
  };

  session.snapshots.push(snapshot);
  if (session.snapshots.length > 100) session.snapshots.shift();

  alerts.forEach((a)    => session.alertHandlers.forEach((h)    => h(a)));
  session.snapshotHandlers.forEach((h) => h(snapshot));
}

export function startMonitoring(projectId: string, intervalMs = 60_000): void {
  if (_sessions.has(projectId)) return;

  const session: MonitorSession = {
    projectId, intervalMs, snapshots: [],
    handle: null, alertHandlers: new Set(), snapshotHandlers: new Set(),
  };
  _sessions.set(projectId, session);
  session.handle = setInterval(() => void runPoll(projectId), intervalMs);
  void runPoll(projectId);
}

export function stopMonitoring(projectId: string): void {
  const s = _sessions.get(projectId);
  if (!s) return;
  if (s.handle !== null) clearInterval(s.handle);
  _sessions.delete(projectId);
}

export function onRiskAlert(projectId: string, handler: AlertHandler): () => void {
  const s = _sessions.get(projectId);
  if (s) s.alertHandlers.add(handler);
  return () => _sessions.get(projectId)?.alertHandlers.delete(handler);
}

export function onRiskSnapshot(projectId: string, handler: SnapshotHandler): () => void {
  const s = _sessions.get(projectId);
  if (s) s.snapshotHandlers.add(handler);
  return () => _sessions.get(projectId)?.snapshotHandlers.delete(handler);
}

export function getRecentSnapshots(projectId: string, limit = 20): MonitoringSnapshot[] {
  return (_sessions.get(projectId)?.snapshots ?? []).slice(-limit);
}
