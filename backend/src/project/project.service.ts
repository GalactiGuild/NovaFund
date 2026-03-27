import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';
import { Project } from './dto/project.dto';
import { ProjectList } from './dto/project-list.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async findById(id: string): Promise<Project> {
    const cacheKey = RedisService.getProjectKey(id);
    
    // Try to get from cache first
    const cachedProject = await this.redisService.get<Project>(cacheKey);
    if (cachedProject) {
      this.logger.debug(`Cache hit for project ${id}`);
      return cachedProject;
    }

    // If not in cache, fetch from database
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contributions: true,
            milestones: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error(`Project with ID ${id} not found`);
    }

    // Transform to match DTO
    const transformedProject = this.transformProject(project);

    // Cache the result for 5 minutes (300 seconds)
    await this.redisService.set(cacheKey, transformedProject, 300);
    
    this.logger.debug(`Cached project ${id}`);
    return transformedProject;
  }

  async findByContractId(contractId: string): Promise<Project> {
    const cacheKey = `project:contract:${contractId}`;
    
    // Try to get from cache first
    const cachedProject = await this.redisService.get<Project>(cacheKey);
    if (cachedProject) {
      this.logger.debug(`Cache hit for project by contract ID ${contractId}`);
      return cachedProject;
    }

    const project = await this.prisma.project.findUnique({
      where: { contractId },
      include: {
        _count: {
          select: {
            contributions: true,
            milestones: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error(`Project with contract ID ${contractId} not found`);
    }

    const transformedProject = this.transformProject(project);

    // Cache the result for 5 minutes
    await this.redisService.set(cacheKey, transformedProject, 300);
    
    this.logger.debug(`Cached project by contract ID ${contractId}`);
    return transformedProject;
  }

  async findAll(filters: {
    skip?: number;
    take?: number;
    status?: string;
    category?: string;
  } = {}): Promise<ProjectList> {
    const cacheKey = RedisService.getProjectListKey(filters);
    
    // Try to get from cache first
    const cachedResult = await this.redisService.get<ProjectList>(cacheKey);
    if (cachedResult) {
      this.logger.debug(`Cache hit for project list with filters`);
      return cachedResult;
    }

    const { skip = 0, take = 20, status, category } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        include: {
          _count: {
            select: {
              contributions: true,
              milestones: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    const transformedProjects = projects.map(project => this.transformProject(project));
    const hasNextPage = skip + take < total;

    const result: ProjectList = {
      projects: transformedProjects,
      total,
      hasNextPage,
    };

    // Cache the result for 3 minutes (180 seconds)
    await this.redisService.set(cacheKey, result, 180);
    
    this.logger.debug(`Cached project list with filters`);
    return result;
  }

  async findActiveProjects(limit?: number): Promise<Project[]> {
    const cacheKey = `projects:active:${limit || 'all'}`;
    
    // Try to get from cache first
    const cachedProjects = await this.redisService.get<Project[]>(cacheKey);
    if (cachedProjects) {
      this.logger.debug(`Cache hit for active projects`);
      return cachedProjects;
    }

    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      take: limit || undefined,
      include: {
        _count: {
          select: {
            contributions: true,
            milestones: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const transformedProjects = projects.map(project => this.transformProject(project));

    // Cache the result for 2 minutes (120 seconds)
    await this.redisService.set(cacheKey, transformedProjects, 120);
    
    this.logger.debug(`Cached active projects`);
    return transformedProjects;
  }

  async findByCreator(creatorId: string, limit?: number): Promise<Project[]> {
    const cacheKey = RedisService.getUserProjectsKey(creatorId) + `:${limit || 'all'}`;
    
    // Try to get from cache first
    const cachedProjects = await this.redisService.get<Project[]>(cacheKey);
    if (cachedProjects) {
      this.logger.debug(`Cache hit for creator projects`);
      return cachedProjects;
    }

    const projects = await this.prisma.project.findMany({
      where: { creatorId },
      take: limit || undefined,
      include: {
        _count: {
          select: {
            contributions: true,
            milestones: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const transformedProjects = projects.map(project => this.transformProject(project));

    // Cache the result for 3 minutes (180 seconds)
    await this.redisService.set(cacheKey, transformedProjects, 180);
    
    this.logger.debug(`Cached creator projects`);
    return transformedProjects;
  }

  /**
   * Transform database project to GraphQL DTO format
   */
  private transformProject(project: any): Project {
    return {
      id: project.id,
      contractId: project.contractId,
      creatorId: project.creatorId,
      title: project.title,
      description: project.description,
      category: project.category,
      goal: Number(project.goal),
      currentFunds: Number(project.currentFunds),
      deadline: project.deadline.toISOString(),
      ipfsHash: project.ipfsHash,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      _count: project._count,
    };
  }

  /**
   * Invalidate cache for a specific project
   */
  async invalidateProjectCache(projectId: string): Promise<void> {
    await this.redisService.invalidateProjectCache(projectId);
    this.logger.log(`Invalidated cache for project ${projectId}`);
  }

  /**
   * Invalidate cache for all projects (use sparingly)
   */
  async invalidateAllProjectsCache(): Promise<void> {
    await this.redisService.delPattern('projects:*');
    await this.redisService.delPattern('project:*');
    this.logger.log('Invalidated all project cache');
  }
}
