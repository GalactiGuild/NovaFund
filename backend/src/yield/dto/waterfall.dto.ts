import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum WaterfallRecipientType {
  INVESTORS = 'INVESTORS',
  CREATOR = 'CREATOR',
  PLATFORM = 'PLATFORM',
  RESERVE = 'RESERVE',
}

registerEnumType(WaterfallRecipientType, {
  name: 'WaterfallRecipientType',
});

@InputType()
export class WaterfallTierInput {
  @Field(() => Int)
  tierOrder: number;

  @Field(() => WaterfallRecipientType)
  recipientType: WaterfallRecipientType;

  @Field(() => String, { nullable: true })
  maxAmount?: string | null;
}

@ObjectType()
export class WaterfallTier {
  @Field(() => Int)
  tierOrder: number;

  @Field(() => WaterfallRecipientType)
  recipientType: WaterfallRecipientType;

  @Field(() => String, { nullable: true })
  maxAmount?: string | null;
}

@ObjectType()
export class WaterfallAllocation {
  @Field(() => WaterfallRecipientType)
  recipientType: WaterfallRecipientType;

  @Field(() => String)
  amount: string;
}

@ObjectType()
export class WaterfallSimulation {
  @Field(() => String)
  payoutAmount: string;

  @Field(() => [WaterfallAllocation])
  allocations: WaterfallAllocation[];

  @Field(() => String)
  unallocatedAmount: string;
}
