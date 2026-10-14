-- Migration: 20260908000000_sales_pos_module
-- Idempotent, safe, additive migration for Sales & POS module (ETAPA 2)

-- 1. Create Enum SaleStatus if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SaleStatus') THEN
    CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'ANULLED');
  END IF;
END $$;

-- 2. Create Enum SalePaymentMethod if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalePaymentMethod') THEN
    CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'CREDIT');
  END IF;
END $$;

-- 3. Create Sale table
CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "saleNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "cashReceived" DECIMAL(12,2),
    "cashChange" DECIMAL(12,2),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "annulledAt" TIMESTAMP(3),
    "annulledBy" TEXT,
    "annulReason" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- Unique index on saleNumber
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- Indexes for Sale
CREATE INDEX IF NOT EXISTS "Sale_businessId_idx" ON "Sale"("businessId");
CREATE INDEX IF NOT EXISTS "Sale_storeId_idx" ON "Sale"("storeId");
CREATE INDEX IF NOT EXISTS "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX IF NOT EXISTS "Sale_status_idx" ON "Sale"("status");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt");

-- Foreign key constraints for Sale
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_storeId_fkey') THEN
    ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Location"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_clientId_fkey') THEN
    ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Create SaleItem table
CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCodeSnapshot" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "productType" "ProductSaleType" NOT NULL DEFAULT 'UNIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- Indexes for SaleItem
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_productId_idx" ON "SaleItem"("productId");

-- Foreign keys for SaleItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_saleId_fkey') THEN
    ALTER TABLE "SaleItem"
    ADD CONSTRAINT "SaleItem_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_productId_fkey') THEN
    ALTER TABLE "SaleItem"
    ADD CONSTRAINT "SaleItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Create SalePayment table
CREATE TABLE IF NOT EXISTS "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "SalePaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- Indexes for SalePayment
CREATE INDEX IF NOT EXISTS "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX IF NOT EXISTS "SalePayment_method_idx" ON "SalePayment"("method");

-- Foreign key for SalePayment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalePayment_saleId_fkey') THEN
    ALTER TABLE "SalePayment"
    ADD CONSTRAINT "SalePayment_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Add saleId to CreditPurchase
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'CreditPurchase' AND column_name = 'saleId'
  ) THEN
    ALTER TABLE "CreditPurchase" ADD COLUMN "saleId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CreditPurchase_saleId_idx" ON "CreditPurchase"("saleId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditPurchase_saleId_fkey') THEN
    ALTER TABLE "CreditPurchase"
    ADD CONSTRAINT "CreditPurchase_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Seed Permissions for Sales Module
INSERT INTO "Permission" ("id", "code", "name", "module", "description", "createdAt")
VALUES
  ('perm-sales-view', 'sales.view', 'Ver ventas e historial', 'sales', 'Consultar historial y detalle de ventas', CURRENT_TIMESTAMP),
  ('perm-sales-create', 'sales.create', 'Registrar ventas POS', 'sales', 'Operar POS y confirmar ventas con diversos medios de pago', CURRENT_TIMESTAMP),
  ('perm-sales-annul', 'sales.annul', 'Anular ventas', 'sales', 'Anular ventas completadas revirtiendo inventario y saldo', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 8. Assign Sales Permissions to Administrador
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-admin-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'Administrador'
  AND p."code" IN ('sales.view', 'sales.create', 'sales.annul')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 9. Assign Sales Permissions to Cajero (view + create only, NOT annul)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-cajero-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN ('sales.view', 'sales.create')
WHERE r."name" = 'Cajero'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
