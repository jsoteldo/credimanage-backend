-- Migration: 20260907000000_inventory_stock_and_movements
-- Idempotent, safe, additive migration for Multi-Store / Multi-Warehouse Inventory (ETAPA 1)

-- 1. Create Enum InventoryMovementType if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryMovementType') THEN
    CREATE TYPE "InventoryMovementType" AS ENUM (
      'INITIAL',
      'ENTRY',
      'ADJUSTMENT_POSITIVE',
      'ADJUSTMENT_NEGATIVE',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'SALE',
      'SALE_REVERSAL',
      'RETURN'
    );
  END IF;
END $$;

-- 2. Create InventoryStock table
CREATE TABLE IF NOT EXISTS "InventoryStock" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- Unique index on (locationId, productId)
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryStock_locationId_productId_key" 
ON "InventoryStock"("locationId", "productId");

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "InventoryStock_locationId_idx" 
ON "InventoryStock"("locationId");

CREATE INDEX IF NOT EXISTS "InventoryStock_productId_idx" 
ON "InventoryStock"("productId");

-- Foreign key constraints for InventoryStock
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStock_locationId_fkey') THEN
    ALTER TABLE "InventoryStock" 
    ADD CONSTRAINT "InventoryStock_locationId_fkey" 
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStock_productId_fkey') THEN
    ALTER TABLE "InventoryStock" 
    ADD CONSTRAINT "InventoryStock_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Create InventoryMovement table
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "previousStock" DECIMAL(12,3) NOT NULL,
    "newStock" DECIMAL(12,3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- Indexes for InventoryMovement
CREATE INDEX IF NOT EXISTS "InventoryMovement_locationId_idx" 
ON "InventoryMovement"("locationId");

CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_idx" 
ON "InventoryMovement"("productId");

CREATE INDEX IF NOT EXISTS "InventoryMovement_type_idx" 
ON "InventoryMovement"("type");

CREATE INDEX IF NOT EXISTS "InventoryMovement_referenceId_idx" 
ON "InventoryMovement"("referenceId");

CREATE INDEX IF NOT EXISTS "InventoryMovement_createdAt_idx" 
ON "InventoryMovement"("createdAt");

-- Foreign key constraints for InventoryMovement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_locationId_fkey') THEN
    ALTER TABLE "InventoryMovement" 
    ADD CONSTRAINT "InventoryMovement_locationId_fkey" 
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_productId_fkey') THEN
    ALTER TABLE "InventoryMovement" 
    ADD CONSTRAINT "InventoryMovement_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Seed Permissions for Inventory Module
INSERT INTO "Permission" ("id", "code", "name", "module", "description", "createdAt")
VALUES
  ('perm-inv-view', 'inventory.view', 'Ver inventario', 'inventory', 'Consultar existencias y movimientos de inventario', CURRENT_TIMESTAMP),
  ('perm-inv-entry', 'inventory.entry', 'Agregar inventario', 'inventory', 'Registrar entradas directas de stock', CURRENT_TIMESTAMP),
  ('perm-inv-adjust', 'inventory.adjust', 'Ajustar inventario', 'inventory', 'Realizar ajustes positivos y negativos de stock', CURRENT_TIMESTAMP),
  ('perm-inv-transfer', 'inventory.transfer', 'Transferir inventario', 'inventory', 'Realizar transferencias entre tiendas y almacenes', CURRENT_TIMESTAMP),
  ('perm-inv-minstock', 'inventory.min_stock', 'Modificar stock mínimo', 'inventory', 'Configurar límites de stock mínimo por tienda/almacén', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 5. Assign Inventory Permissions to Administrador
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-admin-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'Administrador'
  AND p."code" IN ('inventory.view', 'inventory.entry', 'inventory.adjust', 'inventory.transfer', 'inventory.min_stock')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 6. Assign Read-Only Inventory Permission to Cajero
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-cajero-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" = 'inventory.view'
WHERE r."name" = 'Cajero'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
