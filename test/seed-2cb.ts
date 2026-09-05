import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

import { assertNonProductionDatabase } from './assert-non-production-db';
dotenv.config({ path: path.join(__dirname, '../.env.e2e') });
assertNonProductionDatabase(process.env.DATABASE_URL);

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanE2eDatabase, ensureE2eDatabase } from './setup-e2e-db';
import { TransactionsService } from '../src/transactions/transactions.service';

export async function seed2cbFixtures() {
  assertNonProductionDatabase(process.env.DATABASE_URL);
  await ensureE2eDatabase();
  await cleanE2eDatabase();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  const prisma = app.get(PrismaService);
  const txService = app.get(TransactionsService);

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Users
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin E2E',
      email: 'admin@credimanage.com',
      password: hashedPassword,
      role: 'Administrador',
      active: true,
      approved: true,
    },
  });

  const cashierUser = await prisma.user.create({
    data: {
      name: 'Cajero E2E',
      email: 'cajero@credimanage.com',
      password: hashedPassword,
      role: 'Cajero',
      active: true,
      approved: true,
    },
  });

  // 2. Client A: Carlos Mendoza (Deuda corriente 300 + 2 préstamos 300 y 400)
  const clientA = await prisma.client.create({
    data: {
      clientNumber: 'CLI-001',
      name: 'Carlos Mendoza',
      phone: '999111222',
      address: 'Av. Principal 123',
      creditLimit: 2000,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'NATIVE_V1',
    },
  });

  // Daily purchase 300
  await txService.addCreditPurchase(
    clientA.id,
    { product: 'Mercadería Tienda', unitPrice: 300, quantity: 1 },
    adminUser,
  );

  // Loan A: 300 (1 cuota)
  await txService.createLoanCredit(
    clientA.id,
    {
      capital: 300,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
      ticketNumber: 'CR-101',
      product: 'Préstamo A - Capital de Trabajo',
    },
    adminUser,
  );

  // Loan B: 400 (1 cuota)
  await txService.createLoanCredit(
    clientA.id,
    {
      capital: 400,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-15',
      ticketNumber: 'CR-102',
      product: 'Préstamo B - Equipamiento',
    },
    adminUser,
  );

  // 3. Client B: Ana Centavos (Deuda exacta S/ 0.01)
  const clientB = await prisma.client.create({
    data: {
      clientNumber: 'CLI-002',
      name: 'Ana Centavos',
      phone: '999222333',
      address: 'Jr. Comercio 456',
      creditLimit: 500,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'NATIVE_V1',
    },
  });

  await txService.addCreditPurchase(
    clientB.id,
    { product: 'Golosina', unitPrice: 0.01, quantity: 1 },
    adminUser,
  );

  // 4. Client C: Pedro Saldo Cero (Deuda 0.00)
  await prisma.client.create({
    data: {
      clientNumber: 'CLI-003',
      name: 'Pedro Saldo Cero',
      phone: '999333444',
      address: 'Calle Los Pinos 789',
      creditLimit: 500,
      dailyDebtBalance: 0,
      bankDebtBalance: 0,
      currentBalance: 0,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'NATIVE_V1',
    },
  });

  // 5. Client D: María Saldo Favor (dailyDebt -50, bankDebt 600)
  const clientD = await prisma.client.create({
    data: {
      clientNumber: 'CLI-004',
      name: 'María Saldo Favor',
      phone: '999444555',
      address: 'Av. Las Flores 321',
      creditLimit: 1000,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'NATIVE_V1',
    },
  });

  await txService.addCreditPurchase(
    clientD.id,
    { product: 'Bebidas', unitPrice: 50, quantity: 1 },
    adminUser,
  );

  await txService.createLoanCredit(
    clientD.id,
    {
      capital: 600,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
      ticketNumber: 'CR-401',
      product: 'Préstamo María',
    },
    adminUser,
  );

  await txService.registerDailyDebtPayment(
    clientD.id,
    { amount: 100, paymentMethod: 'Efectivo', notes: 'Sobrepago' },
    adminUser,
  );

  // 6. Client E: Roberto Sin Límite (creditLimit = 0, dailyDebt = 100)
  const clientE = await prisma.client.create({
    data: {
      clientNumber: 'CLI-005',
      name: 'Roberto Sin Límite',
      phone: '999555666',
      address: 'Pasaje Unión 654',
      creditLimit: 0,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'NATIVE_V1',
    },
  });

  await txService.addCreditPurchase(
    clientE.id,
    { product: 'Insumos', unitPrice: 100, quantity: 1 },
    adminUser,
  );

  console.log('✅ [2C-B SEED] Fixtures creados exitosamente en credimanage_e2e_test');

  await app.close();
}

if (require.main === module) {
  seed2cbFixtures()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error seeding fixtures:', err);
      process.exit(1);
    });
}
