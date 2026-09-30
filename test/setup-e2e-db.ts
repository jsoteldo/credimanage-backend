import { Client } from 'pg';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { assertNonProductionDatabase } from './assert-non-production-db';

// Load .env.e2e if present
dotenv.config({ path: path.join(__dirname, '../.env.e2e') });

export async function ensureE2eDatabase(): Promise<void> {
  const targetUrl = process.env.DATABASE_URL;

  // 1. STRICT SAFETY GUARD: Must execute first
  assertNonProductionDatabase(targetUrl);

  const parsed = new URL(targetUrl!);
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  // Connect to default 'postgres' database to check/create target database
  const adminUrl = `postgresql://${parsed.username}:${parsed.password}@${parsed.hostname}:${parsed.port || 5432}/postgres`;
  const pgClient = new Client({ connectionString: adminUrl });

  await pgClient.connect();
  try {
    const res = await pgClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );

    if (res.rowCount === 0) {
      console.log(
        `[E2E SETUP] Database "${dbName}" does not exist. Creating...`,
      );
      await pgClient.query(`CREATE DATABASE "${dbName}";`);
      console.log(`[E2E SETUP] Database "${dbName}" created successfully.`);
    } else {
      console.log(`[E2E SETUP] Database "${dbName}" already exists.`);
    }
  } finally {
    await pgClient.end();
  }

  // Deploy migrations to credimanage_e2e_test
  console.log(`[E2E SETUP] Deploying Prisma migrations to ${dbName}...`);
  execSync(`npx prisma migrate deploy`, {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: targetUrl,
    },
    stdio: 'inherit',
  });

  // Ensure un-migrated schema.prisma columns exist in the E2E database
  const schemaClient = new Client({ connectionString: targetUrl });
  await schemaClient.connect();
  try {
    await schemaClient.query(`
      ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'Generico';

      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN 
          CREATE TYPE "PaymentStatus" AS ENUM ('APPROVED', 'PENDING_APPROVAL', 'REJECTED'); 
        END IF; 
      END $$;

      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvedStatus" "PaymentStatus" NOT NULL DEFAULT 'APPROVED';
      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
      ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
    `);
  } finally {
    await schemaClient.end();
  }

  console.log(
    `[E2E SETUP] Migrations and schema successfully deployed to ${dbName}.`,
  );
}

export async function cleanE2eDatabase(): Promise<void> {
  const targetUrl = process.env.DATABASE_URL;

  // 1. STRICT SAFETY GUARD: Must execute first before any destructive operations
  assertNonProductionDatabase(targetUrl);

  const pgClient = new Client({ connectionString: targetUrl });
  await pgClient.connect();
  try {
    // Truncate all tables in public schema in credimanage_e2e_test
    await pgClient.query(`
      TRUNCATE TABLE 
        "BalanceOpeningSnapshot",
        "BalanceAdjustment",
        "Installment",
        "Loan",
        "CreditPurchase",
        "Payment",
        "AuditLog",
        "Client",
        "User"
      CASCADE;
    `);
  } finally {
    await pgClient.end();
  }
}
