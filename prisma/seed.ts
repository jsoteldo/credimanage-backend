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

  // Cash module permissions
  const cashPerms = [
    { code: 'cash.open', name: 'Abrir turno', module: 'cash', description: 'Permite realizar la apertura de un turno de caja con fondo inicial.' },
    { code: 'cash.close', name: 'Cerrar turno', module: 'cash', description: 'Permite realizar el arqueo y cierre definitivo de turno de caja.' },
    { code: 'cash.cash_in', name: 'Registrar ingresos manuales', module: 'cash', description: 'Permite agregar efectivo manualmente a una caja abierta.' },
    { code: 'cash.cash_out', name: 'Registrar retiros / egresos', module: 'cash', description: 'Permite retirar efectivo manualmente de una caja abierta.' },
    { code: 'cash.view', name: 'Consultar historial de caja', module: 'cash', description: 'Permite consultar el historial de turnos, arqueos y movimientos de caja.' },
    { code: 'cash.manage', name: 'Gestionar cajas registradoras', module: 'cash', description: 'Permite crear, editar, activar y desactivar cajas registradoras.' },
  ];

  for (const p of cashPerms) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'Administrador' } });
  if (adminRole) {
    for (const p of cashPerms) {
      const perm = await prisma.permission.findUnique({ where: { code: p.code } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: adminRole.id, permissionId: perm.id },
        });
      }
    }
  }

  const cajeroRole = await prisma.role.findUnique({ where: { name: 'Cajero' } });
  if (cajeroRole) {
    for (const code of ['cash.open', 'cash.close', 'cash.view']) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: cajeroRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: cajeroRole.id, permissionId: perm.id },
        });
      }
    }
  }

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
