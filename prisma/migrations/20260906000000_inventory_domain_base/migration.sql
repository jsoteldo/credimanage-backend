-- Migration: 20260906000000_inventory_domain_base
-- Idempotent, safe, additive migration for Products & Inventory Domain Base

-- 1. Create Enums if not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationType') THEN
    CREATE TYPE "LocationType" AS ENUM ('STORE', 'WAREHOUSE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductSaleType') THEN
    CREATE TYPE "ProductSaleType" AS ENUM ('UNIT', 'WEIGHT', 'KIT');
  END IF;
END $$;

-- 2. Create Role table
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

-- 3. Create Permission table
CREATE TABLE IF NOT EXISTS "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_code_key" ON "Permission"("code");

-- 4. Create RolePermission table
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- 5. Add roleId to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_roleId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Create Location table
CREATE TABLE IF NOT EXISTS "Location" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "type" "LocationType" NOT NULL DEFAULT 'STORE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Location_businessId_name_key" ON "Location"("businessId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Location_businessId_code_key" ON "Location"("businessId", "code");
CREATE INDEX IF NOT EXISTS "Location_businessId_active_idx" ON "Location"("businessId", "active");

-- 7. Create Department table
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Department_businessId_name_key" ON "Department"("businessId", "name");
CREATE INDEX IF NOT EXISTS "Department_businessId_active_idx" ON "Department"("businessId", "active");

-- 8. Create Supplier table
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_businessId_name_key" ON "Supplier"("businessId", "name");
CREATE INDEX IF NOT EXISTS "Supplier_businessId_active_idx" ON "Supplier"("businessId", "active");

-- 9. Create Product table
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'default',
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "saleType" "ProductSaleType" NOT NULL DEFAULT 'UNIT',
    "costPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "wholesalePrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tracksInventory" BOOLEAN NOT NULL DEFAULT true,
    "defaultMinStock" DECIMAL(12,3) DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_businessId_sku_key" ON "Product"("businessId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");
CREATE INDEX IF NOT EXISTS "Product_businessId_active_idx" ON "Product"("businessId", "active");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_departmentId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 10. Create ProductKitComponent table
CREATE TABLE IF NOT EXISTS "ProductKitComponent" (
    "id" TEXT NOT NULL,
    "kitProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductKitComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductKitComponent_kitProductId_componentProductId_key" ON "ProductKitComponent"("kitProductId", "componentProductId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductKitComponent_kitProductId_fkey') THEN
    ALTER TABLE "ProductKitComponent" ADD CONSTRAINT "ProductKitComponent_kitProductId_fkey" FOREIGN KEY ("kitProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductKitComponent_componentProductId_fkey') THEN
    ALTER TABLE "ProductKitComponent" ADD CONSTRAINT "ProductKitComponent_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_roleId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_permissionId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 11. Seed Baseline Roles idempotently
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES
  ('role-admin-system-id', 'Administrador', 'Acceso total y configuración administrativa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role-cajero-system-id', 'Cajero', 'Operación de punto de venta y consultas de catálogo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role-generico-system-id', 'Generico', 'Rol genérico básico', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- 12. Seed Permissions idempotently
INSERT INTO "Permission" ("id", "code", "name", "module", "description", "createdAt")
VALUES
  ('perm-prod-view', 'product.view', 'Ver productos', 'products', 'Consultar lista y detalle de productos', CURRENT_TIMESTAMP),
  ('perm-prod-create', 'product.create', 'Crear productos', 'products', 'Registrar nuevos productos en catálogo', CURRENT_TIMESTAMP),
  ('perm-prod-edit', 'product.edit', 'Editar productos', 'products', 'Modificar datos de productos existentes', CURRENT_TIMESTAMP),
  ('perm-prod-deact', 'product.deactivate', 'Desactivar productos', 'products', 'Desactivar o reactivar productos', CURRENT_TIMESTAMP),
  ('perm-prod-import', 'product.import', 'Importar productos', 'products', 'Importar productos masivamente desde Excel', CURRENT_TIMESTAMP),
  ('perm-dept-view', 'department.view', 'Ver departamentos', 'departments', 'Consultar departamentos de productos', CURRENT_TIMESTAMP),
  ('perm-dept-manage', 'department.manage', 'Gestionar departamentos', 'departments', 'Crear, editar y desactivar departamentos', CURRENT_TIMESTAMP),
  ('perm-supp-view', 'supplier.view', 'Ver proveedores', 'suppliers', 'Consultar proveedores', CURRENT_TIMESTAMP),
  ('perm-supp-manage', 'supplier.manage', 'Gestionar proveedores', 'suppliers', 'Crear, editar y desactivar proveedores', CURRENT_TIMESTAMP),
  ('perm-kit-view', 'kit.view', 'Ver kits', 'kits', 'Consultar productos compuestos y combos', CURRENT_TIMESTAMP),
  ('perm-kit-manage', 'kit.manage', 'Gestionar kits', 'kits', 'Crear y editar componentes de kits', CURRENT_TIMESTAMP),
  ('perm-loc-view', 'location.view', 'Ver ubicaciones', 'locations', 'Consultar tiendas y almacenes', CURRENT_TIMESTAMP),
  ('perm-loc-manage', 'location.manage', 'Gestionar ubicaciones', 'locations', 'Crear y configurar tiendas y almacenes', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 13. Assign All Permissions to Administrador
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-admin-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'Administrador'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 14. Assign View Permissions to Cajero
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 
  'rp-cajero-' || p."id",
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN ('product.view', 'department.view', 'supplier.view', 'kit.view', 'location.view')
WHERE r."name" = 'Cajero'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 15. Backfill existing Users: set roleId according to user.role
UPDATE "User" u
SET "roleId" = r."id"
FROM "Role" r
WHERE r."name" = u."role"::text
  AND u."roleId" IS NULL;
