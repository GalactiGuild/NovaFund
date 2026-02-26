// Trust Score Calculator
// Calculates a creator's trust score based on successful projects, milestone completion rate, and funds distribution.

import { PrismaClient } from '@prisma/client';

export async function calculateTrustScore(prisma: PrismaClient, creatorId: string): Promise<number> {
  // 1. Number of successful projects
  const successfulProjects = await prisma.project.count({
    where: { creatorId, status: 'COMPLETED' },
  });

  // 2. Milestone stats
  const milestones = await prisma.milestone.findMany({
    where: { project: { creatorId } },
    select: { status: true, createdAt: true, completionDate: true },
  });
  const totalMilestones = milestones.length;
  const completedOnTime = milestones.filter(m => m.status === 'APPROVED' && m.completionDate && m.completionDate <= m.createdAt).length;
  const failedMilestones = milestones.filter(m => m.status === 'REJECTED').length;

  // 3. Funds stats
  const projects = await prisma.project.findMany({
    where: { creatorId },
    select: { goal: true, currentFunds: true },
  });
  const totalRaised = projects.reduce((sum, p) => sum + Number(p.goal), 0);
  const totalDistributed = projects.reduce((sum, p) => sum + Number(p.currentFunds), 0);

  // Scoring
  let score = 500;
  score += successfulProjects * 100;
  score += completedOnTime * 50;
  score -= failedMilestones * 75;
  score += totalRaised > 0 ? Math.round((totalDistributed / totalRaised) * 200) : 0;
  score = Math.max(0, Math.min(1000, score));
  return score;
}
