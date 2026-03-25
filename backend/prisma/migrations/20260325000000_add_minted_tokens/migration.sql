-- CreateTable
CREATE TABLE "minted_tokens" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "transaction_hash" TEXT NOT NULL,
    "project_id" TEXT,
    "recipient" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "admin" TEXT,
    "ledger_seq" INTEGER NOT NULL,
    "minted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minted_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "minted_tokens_transaction_hash_key" ON "minted_tokens"("transaction_hash");

-- CreateIndex
CREATE INDEX "minted_tokens_contract_id_idx" ON "minted_tokens"("contract_id");

-- CreateIndex
CREATE INDEX "minted_tokens_recipient_idx" ON "minted_tokens"("recipient");

-- CreateIndex
CREATE INDEX "minted_tokens_project_id_idx" ON "minted_tokens"("project_id");
