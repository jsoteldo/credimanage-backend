-- Bloqueo preventivo de tablas para clasificación atómica sin condición de carrera
LOCK TABLE "CreditPurchase", "Payment" IN EXCLUSIVE MODE;

-- 1. Agregar isBaselineMovement con DEFAULT true para poblar filas existentes atómicamente
ALTER TABLE "CreditPurchase" ADD COLUMN IF NOT EXISTS "isBaselineMovement" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "isBaselineMovement" BOOLEAN NOT NULL DEFAULT true;

-- 2. Modificar DEFAULT a false para todas las inserciones futuras
ALTER TABLE "CreditPurchase" ALTER COLUMN "isBaselineMovement" SET DEFAULT false;
ALTER TABLE "Payment" ALTER COLUMN "isBaselineMovement" SET DEFAULT false;

-- 3. Agregar createdAt como nullable sin default inicialmente para no alterar filas históricas (quedan NULL)
ALTER TABLE "CreditPurchase" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

-- 4. Establecer DEFAULT CURRENT_TIMESTAMP para inserciones futuras
ALTER TABLE "CreditPurchase" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- 5. Agregar campos de trazabilidad no ambigua a Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "targetType" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "allocations" JSONB;

-- 6. Crear Enum BalanceAdjustmentType
DO $$ BEGIN
  CREATE TYPE "BalanceAdjustmentType" AS ENUM (
    'DAILY_DEBT_REVERSAL',
    'DAILY_PAYMENT_REVERSAL',
    'BANK_LOAN_REVERSAL',
    'BANK_PAYMENT_REVERSAL',
    'MIGRATION_ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 7. Crear Tabla BalanceAdjustment
CREATE TABLE IF NOT EXISTS "BalanceAdjustment" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "BalanceAdjustmentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "loanId" TEXT,
  "paymentId" TEXT,
  "purchaseId" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVO',

  CONSTRAINT "BalanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- 8. Llaves foráneas e índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS "BalanceAdjustment_source_unique" 
  ON "BalanceAdjustment"("sourceType", "sourceId", "type");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BalanceAdjustment_clientId_fkey') THEN
    ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BalanceAdjustment_loanId_fkey') THEN
    ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BalanceAdjustment_paymentId_fkey') THEN
    ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
