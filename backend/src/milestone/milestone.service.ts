import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/notification.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MilestoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Updates a milestone's status.
   * When transitioning to DISPUTED, automatically fans out
   * email + SMS notifications to all project investors.
   */
  async updateStatus(milestoneId: string, newStatus: MilestoneStatus) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    if (milestone.status === newStatus) {
      throw new BadRequestException(`Milestone is already in status ${newStatus}`);
    }

    // Persist the status change
    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: newStatus },
    });

    // ── Hook: fire notifications when entering DISPUTED ──────────────────
    if (newStatus === MilestoneStatus.REJECTED) {
      // Fire-and-forget: don't block the API response
      this.notificationService
        .notifyDisputedMilestone(milestoneId)
        .catch((err) =>
          console.error(`Failed to send dispute notifications for milestone ${milestoneId}:`, err),
        );
    }

    return updated;
  }

  async findById(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    return milestone;
  }

  async findByProject(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
