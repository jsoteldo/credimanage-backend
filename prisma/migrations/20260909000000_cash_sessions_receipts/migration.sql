-- Migration: 20260909000000_cash_sessions_receipts
-- Idempotent, safe, additive migration for Cash Register, Sessions, Movements & Receipts (ETAPA 3)

-- 1. Create Enum CashRegisterStatus if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashRegisterStatus') THEN
    CREATE TYPE "CashRegisterStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

-- 2. Create Enum CashSessionStatus if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashSessionStatus') THEN
    CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

-- 3. Create Enum CashMovementType if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashMovementType') THEN
    CREATE TYPE "CashMovementType" AS ENUM (
      'OPENING',
      'SALE',
      'SALE_REVERSAL',
      'CASH_IN',
      'CASH_OUT',
      'DEBT_PAYMENT',
      'LOAN_PAYMENT',
      'CLOSING_ADJUSTMENT'
    );
  END IF;
END $$;

-- 4. Create CashRegister table
CREATE TABLE IF NOT EXISTS "CashRegister" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on storeId + code
CREATE UNIQUE INDEX IF NOT EXISTS "CashRegister_storeId_code_key" ON "CashRegister"("storeId", "code");
CREATE INDEX IF NOT EXISTS "CashRegister_businessId_idx" ON "CashRegister"("businessId");
CREATE INDEX IF NOT EXISTS "CashRegister_storeId_idx" ON "CashRegister"("storeId");
CREATE INDEX IF NOT EXISTS "CashRegister_status_idx" ON "CashRegister"("status");

-- Foreign key for CashRegister -> Location
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashRegister_storeId_fkey') THEN
    ALTER TABLE "CashRegister"
    ADD CONSTRAINT "CashRegister_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Location"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Create CashSession table
CREATE TABLE IF NOT EXISTS "CashSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "cashRegisterId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCashAmount" DECIMAL(12,2) NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "expectedCashAmount" DECIMAL(12,2),
    "countedCashAmount" DECIMAL(12,2),
    "differenceAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- Indexes for CashSession
CREATE INDEX IF NOT EXISTS "CashSession_businessId_idx" ON "CashSession"("businessId");
CREATE INDEX IF NOT EXISTS "CashSession_cashRegisterId_idx" ON "CashSession"("cashRegisterId");
CREATE INDEX IF NOT EXISTS "CashSession_storeId_idx" ON "CashSession"("storeId");
CREATE INDEX IF NOT EXISTS "CashSession_openedByUserId_idx" ON "CashSession"("openedByUserId");
CREATE INDEX IF NOT EXISTS "CashSession_status_idx" ON "CashSession"("status");
CREATE INDEX IF NOT EXISTS "CashSession_openedAt_idx" ON "CashSession"("openedAt");

-- Partial unique indexes: at most ONE open session per register, and at most ONE open session per user per store
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_open_register_key" ON "CashSession"("cashRegisterId") WHERE ("status" = 'OPEN');
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_open_user_store_key" ON "CashSession"("storeId", "openedByUserId") WHERE ("status" = 'OPEN');

-- Foreign keys for CashSession
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_cashRegisterId_fkey') THEN
    ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_cashRegisterId_fkey"
    FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_storeId_fkey') THEN
    ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Location"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_openedByUserId_fkey') THEN
    ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_openedByUserId_fkey"
    FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_closedByUserId_fkey') THEN
    ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_closedByUserId_fkey"
    FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Add cashSessionId column to Sale table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Sale' AND column_name = 'cashSessionId'
  ) THEN
    ALTER TABLE "Sale" ADD COLUMN "cashSessionId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Sale_cashSessionId_idx" ON "Sale"("cashSessionId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_cashSessionId_fkey') THEN
    ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Create CashMovement table
CREATE TABLE IF NOT EXISTS "CashMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "cashSessionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "saleId" TEXT,
    "type" "CashMovementType" NOT NULL,
    "paymentMethod" "SalePaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- Indexes for CashMovement
CREATE INDEX IF NOT EXISTS "CashMovement_cashSessionId_idx" ON "CashMovement"("cashSessionId");
CREATE INDEX IF NOT EXISTS "CashMovement_storeId_idx" ON "CashMovement"("storeId");
CREATE INDEX IF NOT EXISTS "CashMovement_cashRegisterId_idx" ON "CashMovement"("cashRegisterId");
CREATE INDEX IF NOT EXISTS "CashMovement_saleId_idx" ON "CashMovement"("saleId");
CREATE INDEX IF NOT EXISTS "CashMovement_type_idx" ON "CashMovement"("type");
CREATE INDEX IF NOT EXISTS "CashMovement_paymentMethod_idx" ON "CashMovement"("paymentMethod");
CREATE INDEX IF NOT EXISTS "CashMovement_referenceId_idx" ON "CashMovement"("referenceId");
CREATE INDEX IF NOT EXISTS "CashMovement_createdAt_idx" ON "CashMovement"("createdAt");

-- Foreign keys for CashMovement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_cashSessionId_fkey') THEN
    ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_storeId_fkey') THEN
    ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Location"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_cashRegisterId_fkey') THEN
    ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_cashRegisterId_fkey"
    FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_saleId_fkey') THEN
    ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_createdByUserId_fkey') THEN
    ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 8. Create Receipt table
CREATE TABLE IF NOT EXISTS "Receipt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "saleId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'B001',
    "sequence" INTEGER NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "notes" TEXT,
    "reprintedCount" INTEGER NOT NULL DEFAULT 0,
    "lastReprintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_saleId_key" ON "Receipt"("saleId");
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_number_key" ON "Receipt"("number");
CREATE INDEX IF NOT EXISTS "Receipt_businessId_idx" ON "Receipt"("businessId");
CREATE INDEX IF NOT EXISTS "Receipt_series_sequence_idx" ON "Receipt"("series", "sequence");
CREATE INDEX IF NOT EXISTS "Receipt_createdAt_idx" ON "Receipt"("createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_saleId_fkey') THEN
    ALTER TABLE "Receipt"
    ADD CONSTRAINT "Receipt_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 9. Create ReceiptSequence table
CREATE TABLE IF NOT EXISTS "ReceiptSequence" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "series" TEXT NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReceiptSequence_businessId_series_key" ON "ReceiptSequence"("businessId", "series");

-- 10. Create SystemSetting table if not exists
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
