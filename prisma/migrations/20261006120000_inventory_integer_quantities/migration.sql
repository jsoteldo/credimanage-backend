-- Migration: 20261006120000_inventory_integer_quantities
-- Normalizar datos existentes eliminando cualquier residuo decimal y convertir columnas a INTEGER

-- 1. Normalizar registros históricos de InventoryMovement
UPDATE "InventoryMovement"
SET
  "quantity" = ROUND("quantity"),
  "previousStock" = ROUND("previousStock"),
  "newStock" = ROUND("newStock")
WHERE "quantity" != ROUND("quantity")
   OR "previousStock" != ROUND("previousStock")
   OR "newStock" != ROUND("newStock");

-- 2. Normalizar registros de InventoryStock
UPDATE "InventoryStock"
SET
  "quantity" = ROUND("quantity"),
  "minimumStock" = ROUND("minimumStock")
WHERE "quantity" != ROUND("quantity")
   OR "minimumStock" != ROUND("minimumStock");

-- 3. Normalizar ProductKitComponent si existiera algún residuo
UPDATE "ProductKitComponent"
SET "quantity" = ROUND("quantity")
WHERE "quantity" != ROUND("quantity");

-- 4. Normalizar Product.defaultMinStock si existiera algún residuo
UPDATE "Product"
SET "defaultMinStock" = ROUND("defaultMinStock")
WHERE "defaultMinStock" IS NOT NULL AND "defaultMinStock" != ROUND("defaultMinStock");

-- 5. Normalizar SaleItem si existiera algún residuo
UPDATE "SaleItem"
SET "quantity" = ROUND("quantity")
WHERE "quantity" != ROUND("quantity");

-- 6. Verificación estricta de invariantes: Si quedara algún valor que no pueda convertirse a entero, abortar transacción
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "InventoryStock" WHERE "quantity" != ROUND("quantity") OR "minimumStock" != ROUND("minimumStock")) THEN
    RAISE EXCEPTION 'Anomalía en InventoryStock: existen cantidades no enteras antes de la conversión a INTEGER';
  END IF;
  IF EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "quantity" != ROUND("quantity") OR "previousStock" != ROUND("previousStock") OR "newStock" != ROUND("newStock")) THEN
    RAISE EXCEPTION 'Anomalía en InventoryMovement: existen cantidades no enteras antes de la conversión a INTEGER';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProductKitComponent" WHERE "quantity" != ROUND("quantity")) THEN
    RAISE EXCEPTION 'Anomalía en ProductKitComponent: existen cantidades no enteras antes de la conversión a INTEGER';
  END IF;
  IF EXISTS (SELECT 1 FROM "SaleItem" WHERE "quantity" != ROUND("quantity")) THEN
    RAISE EXCEPTION 'Anomalía en SaleItem: existen cantidades no enteras antes de la conversión a INTEGER';
  END IF;
END $$;

-- 7. Alterar columnas a INTEGER de manera segura y definitiva
ALTER TABLE "InventoryStock"
  ALTER COLUMN "quantity" DROP DEFAULT,
  ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::INTEGER,
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "minimumStock" DROP DEFAULT,
  ALTER COLUMN "minimumStock" TYPE INTEGER USING "minimumStock"::INTEGER,
  ALTER COLUMN "minimumStock" SET DEFAULT 0;

ALTER TABLE "InventoryMovement"
  ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::INTEGER,
  ALTER COLUMN "previousStock" TYPE INTEGER USING "previousStock"::INTEGER,
  ALTER COLUMN "newStock" TYPE INTEGER USING "newStock"::INTEGER;

ALTER TABLE "ProductKitComponent"
  ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::INTEGER;

ALTER TABLE "Product"
  ALTER COLUMN "defaultMinStock" DROP DEFAULT,
  ALTER COLUMN "defaultMinStock" TYPE INTEGER USING "defaultMinStock"::INTEGER,
  ALTER COLUMN "defaultMinStock" SET DEFAULT 0;

ALTER TABLE "SaleItem"
  ALTER COLUMN "quantity" TYPE INTEGER USING "quantity"::INTEGER;
