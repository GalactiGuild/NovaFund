import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { Project } from './dto/project.dto';
import { ProjectList } from './dto/project-list.dto';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => Project, { name: 'project' })
  async getProject(@Args('id') id: string): Promise<Project> {
    return this.projectService.findById(id);
  }

  @Query(() => Project, { name: 'projectByContractId' })
  async getProjectByContractId(@Args('contractId') contractId: string): Promise<Project> {
    return this.projectService.findByContractId(contractId);
  }

  @Query(() => ProjectList, { name: 'projects' })
  async getProjects(
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('category', { type: () => String, nullable: true }) category?: string,
  ): Promise<ProjectList> {
    return this.projectService.findAll({ skip, take, status, category });
  }

  @Query(() => [Project], { name: 'activeProjects' })
  async getActiveProjects(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<Project[]> {
    return this.projectService.findActiveProjects(limit);
  }

  @Query(() => [Project], { name: 'projectsByCreator' })
  async getProjectsByCreator(
    @Args('creatorId') creatorId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<Project[]> {
    return this.projectService.findByCreator(creatorId, limit);
  }
}
