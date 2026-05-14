import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';
import { Project } from './dto/project.dto';

describe('ProjectService', () => {
  let service: ProjectService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockProjectDb = {
    id: 'test-project-id',
    contractId: '123',
    creatorId: 'test-creator-id',
    title: 'Test Project',
    description: 'Test Description',
    category: 'technology',
    goal: 1000,
    currentFunds: 500,
    deadline: new Date('2024-12-31T23:59:59.000Z'),
    ipfsHash: 'test-ipfs-hash',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    _count: {
      contributions: 5,
      milestones: 3,
    },
  };

  const mockProject: Project = {
    ...mockProjectDb,
    deadline: mockProjectDb.deadline.toISOString() as any,
    status: mockProjectDb.status as any,
    createdAt: mockProjectDb.createdAt.toISOString() as any,
    updatedAt: mockProjectDb.updatedAt.toISOString() as any,
    tags: ['test-tag'],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      invalidateProjectCache: jest.fn(),
      invalidateUserCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return cached project if available', async () => {
      // Arrange
      const projectId = 'test-project-id';
      jest.spyOn(redisService, 'get').mockResolvedValue(mockProject);

      // Act
      const result = await service.findById(projectId);

      // Assert
      expect(redisService.get).toHaveBeenCalledWith(`project:${projectId}`);
      expect(result).toEqual(mockProject);
      expect(prismaService.project.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache result when not in cache', async () => {
      // Arrange
      const projectId = 'test-project-id';
      jest.spyOn(redisService, 'get').mockResolvedValue(undefined);
      jest.spyOn(prismaService.project, 'findUnique').mockResolvedValue(mockProjectDb as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      // Act
      const result = await service.findById(projectId);

      // Assert
      expect(redisService.get).toHaveBeenCalledWith(`project:${projectId}`);
      expect(prismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
        select: {
          id: true,
          contractId: true,
          creatorId: true,
          title: true,
          description: true,
          category: true,
          tags: true,
          goal: true,
          currentFunds: true,
          deadline: true,
          ipfsHash: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              contributions: true,
              milestones: true,
            },
          },
        },
      });
      expect(redisService.set).toHaveBeenCalledWith(
        `project:${projectId}`,
        expect.any(Object),
        300
      );
      expect(result).toEqual(mockProject);
    });

    it('should throw error when project not found', async () => {
      // Arrange
      const projectId = 'non-existent-id';
      jest.spyOn(redisService, 'get').mockResolvedValue(undefined);
      jest.spyOn(prismaService.project, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(projectId)).rejects.toThrow(
        `Project with ID ${projectId} not found`
      );
    });
  });

  describe('invalidateProjectCache', () => {
    it('should call redisService.invalidateProjectCache', async () => {
      // Arrange
      const projectId = 'test-project-id';
      jest.spyOn(redisService, 'invalidateProjectCache').mockResolvedValue(undefined);

      // Act
      await service.invalidateProjectCache(projectId);

      // Assert
      expect(redisService.invalidateProjectCache).toHaveBeenCalledWith(projectId);
    });
  });
});
