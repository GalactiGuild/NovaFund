import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Project } from './project.dto';

@ObjectType()
export class ProjectList {
  @Field(() => [Project])
  projects: Project[];

  @Field(() => Int)
  total: number;

  @Field()
  hasNextPage: boolean;
}
