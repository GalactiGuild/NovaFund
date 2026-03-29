-- CreateTable
CREATE TABLE "FiatDeposit" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL DEFAULT 'USDC',
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "anchorProvider" TEXT NOT NULL,
    "anchorTransactionId" TEXT,
    "stellarTransactionId" TEXT,
    "interactiveUrl" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FiatDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiatDeposit_walletAddress_idx" ON "FiatDeposit"("walletAddress");

-- CreateIndex
CREATE INDEX "FiatDeposit_status_idx" ON "FiatDeposit"("status");

-- CreateIndex
CREATE INDEX "FiatDeposit_anchorTransactionId_idx" ON "FiatDeposit"("anchorTransactionId");

-- CreateIndex
CREATE INDEX "FiatDeposit_projectId_idx" ON "FiatDeposit"("projectId");
