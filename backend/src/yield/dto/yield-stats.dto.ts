import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class YieldStats {
  @Field(() => String, { description: 'Total yield generated across all active escrows' })
  totalYield: string;

  @Field(() => Number, { description: 'Number of active escrows contributing yield' })
  activeEscrowCount: number;
}
