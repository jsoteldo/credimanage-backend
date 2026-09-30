/**
 * SAFETY GUARD: Production Database Prevention
 *
 * Strict Requirement:
 * 1. Must run BEFORE PrismaClient, setup, seed, migrations, or any PostgreSQL connection.
 * 2. Positive whitelist: hostname MUST be 127.0.0.1 or localhost AND database name MUST be credimanage_e2e_test.
 * 3. Blacklist: explicitly blocks Neon, sa-east-1, ep-purple-mouse-aceufutz, neondb_owner.
 */

export function assertNonProductionDatabase(dbUrl?: string): boolean {
  const urlToTest = dbUrl || process.env.DATABASE_URL;

  if (!urlToTest || typeof urlToTest !== 'string') {
    throw new Error(
      'FATAL SAFETY ERROR: DATABASE_URL is not defined or empty. Aborting before database connection.',
    );
  }

  const lower = urlToTest.toLowerCase();

  // 1. Blacklist checks against known production signatures
  const blacklistedSignatures = [
    'neon.tech',
    'sa-east-1',
    'ep-purple-mouse-aceufutz',
    'neondb_owner',
  ];

  for (const sig of blacklistedSignatures) {
    if (lower.includes(sig)) {
      throw new Error(
        `FATAL SAFETY VIOLATION: DATABASE_URL contains production signature "${sig}"! Execution aborted immediately before connection.`,
      );
    }
  }

  // 2. Parse URL and validate positive whitelist
  let parsed: URL;
  try {
    parsed = new URL(urlToTest);
  } catch (err: any) {
    throw new Error(
      `FATAL SAFETY ERROR: Failed to parse DATABASE_URL: ${err.message}`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  const allowedHosts = ['localhost', '127.0.0.1'];
  if (!allowedHosts.includes(hostname)) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Host "${hostname}" is not an authorized local test host (must be localhost or 127.0.0.1). Aborting.`,
    );
  }

  const allowedDatabase = 'credimanage_e2e_test';
  if (dbName !== allowedDatabase) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Database name "${dbName}" does not match strict whitelist "${allowedDatabase}". Aborting.`,
    );
  }

  // Passed both blacklist and positive whitelist
  return true;
}
