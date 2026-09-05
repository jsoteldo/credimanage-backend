-- 1. Agregar columna balanceOrigin a Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "balanceOrigin" TEXT;

-- 2. Backfill para clientes existentes con BalanceOpeningSnapshot en BALANCE_MODEL_V1 y status ACTIVO
UPDATE "Client"
SET "balanceOrigin" = 'MIGRATED_BASELINE'
WHERE "id" IN (
  SELECT "clientId"
  FROM "BalanceOpeningSnapshot"
  WHERE "migrationVersion" = 'BALANCE_MODEL_V1'
  AND status = 'ACTIVO'
);
