-- AlterTable Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dailyDebtBalance" DECIMAL(12,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "bankDebtBalance" DECIMAL(12,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "balanceModelVersion" TEXT;

-- CreateTable BalanceOpeningSnapshot
CREATE TABLE IF NOT EXISTS "BalanceOpeningSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "migrationVersion" TEXT NOT NULL,
    "cutOffDate" TIMESTAMP(3) NOT NULL,
    "dailyDebtOpeningBalance" DECIMAL(12,2) NOT NULL,
    "bankDebtOpeningBalance" DECIMAL(12,2) NOT NULL,
    "currentOpeningBalance" DECIMAL(12,2) NOT NULL,
    "creditExposureOpening" DECIMAL(12,2) NOT NULL,
    "legacyUnknownPaymentCount" INTEGER NOT NULL DEFAULT 0,
    "legacyMixedPaymentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "reconciliationRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceOpeningSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BalanceOpeningSnapshot_clientId_migrationVersion_key" ON "BalanceOpeningSnapshot"("clientId", "migrationVersion");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BalanceOpeningSnapshot_clientId_fkey'
  ) THEN
    ALTER TABLE "BalanceOpeningSnapshot" ADD CONSTRAINT "BalanceOpeningSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
