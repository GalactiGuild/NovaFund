import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { ProjectStatus } from '@prisma/client';

@ObjectType()
export class Project {
  @Field()
  id: string;

  @Field()
  contractId: string;

  @Field()
  creatorId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  category: string;

  @Field(() => Float)
  goal: number;

  @Field(() => Float)
  currentFunds: number;

  @Field()
  deadline: string;

  @Field({ nullable: true })
  ipfsHash?: string;

  @Field(() => ProjectStatus)
  status: ProjectStatus;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field(() => Int, { nullable: true })
  _count?: {
    contributions: number;
    milestones: number;
  };
}
