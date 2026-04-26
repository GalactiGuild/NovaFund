-- CreateEnum
CREATE TYPE "PayoutRecipientType" AS ENUM ('INVESTORS', 'CREATOR', 'PLATFORM', 'RESERVE');

-- CreateTable
CREATE TABLE "project_payout_tiers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "recipient_type" "PayoutRecipientType" NOT NULL,
    "max_amount" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_payout_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_costs" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total_fee_charged" BIGINT NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_cost_events" (
    "id" TEXT NOT NULL,
    "tx_hash" TEXT,
    "source" TEXT NOT NULL,
    "fee_charged" BIGINT NOT NULL,
    "ledger" INTEGER,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_cost_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stellar_ecosystem_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "top_traded_assets" JSONB NOT NULL,
    "dex_volume_24h" BIGINT NOT NULL DEFAULT 0,
    "rwa_dex_volume_24h" BIGINT NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'horizon',
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stellar_ecosystem_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_payout_tiers_project_id_tier_order_key" ON "project_payout_tiers"("project_id", "tier_order");
CREATE INDEX "project_payout_tiers_project_id_idx" ON "project_payout_tiers"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_costs_date_key" ON "operational_costs"("date");
CREATE INDEX "operational_costs_date_idx" ON "operational_costs"("date");

-- CreateIndex
CREATE INDEX "operational_cost_events_captured_at_idx" ON "operational_cost_events"("captured_at");
CREATE INDEX "operational_cost_events_source_idx" ON "operational_cost_events"("source");

-- CreateIndex
CREATE UNIQUE INDEX "stellar_ecosystem_snapshots_snapshot_date_key" ON "stellar_ecosystem_snapshots"("snapshot_date");
CREATE INDEX "stellar_ecosystem_snapshots_captured_at_idx" ON "stellar_ecosystem_snapshots"("captured_at");

-- AddForeignKey
ALTER TABLE "project_payout_tiers"
ADD CONSTRAINT "project_payout_tiers_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
