import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OperationalCostDay {
  @Field(() => String)
  date: string;

  @Field(() => String)
  totalFeeCharged: string;

  @Field(() => Int)
  eventCount: number;
}

@ObjectType()
export class OperationalCostBreakdown {
  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field(() => String)
  totalFeeCharged: string;

  @Field(() => Int)
  totalEvents: number;

  @Field(() => [OperationalCostDay])
  days: OperationalCostDay[];
}
