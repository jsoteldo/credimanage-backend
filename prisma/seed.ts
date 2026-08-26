import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking and seeding structural users...');
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const cajeroPasswordHash = bcrypt.hashSync('cajero123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@credimanage.pos' },
    update: {},
    create: {
      id: 'usr-1',
      name: 'Carlos Mendoza',
      email: 'admin@credimanage.pos',
      password: adminPasswordHash,
      role: 'Administrador',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      active: true,
      approved: true,
      createdAt: new Date('2026-01-01T08:00:00Z'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'cajero@credimanage.pos' },
    update: {},
    create: {
      id: 'usr-2',
      name: 'Sofía Castro (Cajera)',
      email: 'cajero@credimanage.pos',
      password: cajeroPasswordHash,
      role: 'Cajero',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150',
      active: true,
      approved: true,
      createdAt: new Date('2026-01-15T09:30:00Z'),
    },
  });

  console.log('Database structural seeding checked/completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
