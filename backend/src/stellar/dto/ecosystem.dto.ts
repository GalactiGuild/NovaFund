import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EcosystemAssetVolume {
  @Field(() => String)
  assetCode: string;

  @Field(() => String, { nullable: true })
  assetIssuer?: string;

  @Field(() => String)
  tradedVolume: string;
}

@ObjectType()
export class StellarEcosystemContext {
  @Field(() => String)
  snapshotDate: string;

  @Field(() => String)
  capturedAt: string;

  @Field(() => String)
  dexVolume24h: string;

  @Field(() => String)
  rwaDexVolume24h: string;

  @Field(() => [EcosystemAssetVolume])
  topTradedAssets: EcosystemAssetVolume[];
}
