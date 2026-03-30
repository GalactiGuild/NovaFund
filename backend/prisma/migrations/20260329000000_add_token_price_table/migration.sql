-- CreateTable
CREATE TABLE "token_prices" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "sources" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_prices_symbol_fetched_at_idx" ON "token_prices"("symbol", "fetched_at");
