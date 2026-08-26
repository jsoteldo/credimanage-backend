import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: No se puede ejecutar la limpieza de base de datos en entorno de PRODUCCIÓN.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando limpieza de datos transaccionales y de negocio...');

  await prisma.auditLog.deleteMany();
  console.log('- Logs de auditoría eliminados.');

  await prisma.payment.deleteMany();
  console.log('- Abonos de clientes eliminados.');

  await prisma.creditPurchase.deleteMany();
  console.log('- Compras a crédito de clientes eliminadas.');

  await prisma.client.deleteMany();
  console.log('- Clientes de negocio eliminados.');

  console.log('Limpieza completada. La base de datos está vacía de negocio y lista para su uso.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
