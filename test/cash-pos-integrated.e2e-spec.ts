import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

// 1. STRICT SAFETY GUARD: Verify test database before anything runs
import { assertNonProductionDatabase } from './assert-non-production-db';
dotenv.config({ path: path.join(__dirname, '../.env.e2e') });
assertNonProductionDatabase(process.env.DATABASE_URL);

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SalesService } from '../src/sales/sales.service';
import { CashService } from '../src/cash/cash.service';
import { TransactionsService } from '../src/transactions/transactions.service';
import { cleanE2eDatabase, ensureE2eDatabase } from './setup-e2e-db';
import {
  SalePaymentMethod,
  CashSessionStatus,
  CashMovementType,
  Prisma,
} from '@prisma/client';

describe('ETAPA 3 — Sección 72 & 73: Prueba Integrada Principal Caja + POS + Deuda + Boletas', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let salesService: SalesService;
  let cashService: CashService;
  let transactionsService: TransactionsService;

  let testUser: any;
  let testStore: any;
  let testRegister: any;
  let testClient: any;
  let prodPolo: any;
  let prodJean: any;
  let prodGorra: any;

  beforeAll(async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);
    await ensureE2eDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    salesService = app.get(SalesService);
    cashService = app.get(CashService);
    transactionsService = app.get(TransactionsService);
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);
    await cleanE2eDatabase();

    // 1. Setup User
    const passwordHash = await bcrypt.hash('123456', 10);
    testUser = await prisma.user.create({
      data: {
        id: 'usr-admin-test',
        name: 'Carlos Mendoza',
        email: 'carlos@credimanage.com',
        password: passwordHash,
        role: 'Administrador',
        active: true,
        approved: true,
      },
    });

    // 2. Setup Store
    testStore = await prisma.location.create({
      data: {
        id: 'loc-tienda-centro',
        name: 'Tienda Centro',
        code: 'TC-01',
        type: 'STORE',
        active: true,
      },
    });

    // 3. Setup CashRegister
    testRegister = await prisma.cashRegister.create({
      data: {
        id: 'reg-caja-01',
        storeId: testStore.id,
        code: 'CAJA-01',
        name: 'Caja 01',
        status: 'ACTIVE',
      },
    });

    // 4. Setup Client with baseline credit
    testClient = await prisma.client.create({
      data: {
        id: 'cli-juan-perez',
        clientNumber: 'CLI-0001',
        name: 'Juan Pérez',
        phone: '999888777',
        creditLimit: 500,
        dailyDebtBalance: new Prisma.Decimal(0),
        bankDebtBalance: new Prisma.Decimal(0),
        currentBalance: 0,
        status: 'Activo',
      },
    });

    // 5. Setup Products
    prodPolo = await prisma.product.create({
      data: {
        id: 'prod-polo',
        sku: 'POL-01',
        name: 'Polo Urbano',
        saleType: 'UNIT',
        costPrice: new Prisma.Decimal(20),
        salePrice: new Prisma.Decimal(40),
        active: true,
      },
    });

    prodJean = await prisma.product.create({
      data: {
        id: 'prod-jean',
        sku: 'JEA-01',
        name: 'Jean Clásico',
        saleType: 'UNIT',
        costPrice: new Prisma.Decimal(30),
        salePrice: new Prisma.Decimal(60),
        active: true,
      },
    });

    prodGorra = await prisma.product.create({
      data: {
        id: 'prod-gorra',
        sku: 'GOR-01',
        name: 'Gorra Deportiva',
        saleType: 'UNIT',
        costPrice: new Prisma.Decimal(25),
        salePrice: new Prisma.Decimal(50),
        active: true,
      },
    });

    // Setup initial stocks
    await prisma.inventoryStock.createMany({
      data: [
        { locationId: testStore.id, productId: prodPolo.id, quantity: 50 },
        { locationId: testStore.id, productId: prodJean.id, quantity: 50 },
        { locationId: testStore.id, productId: prodGorra.id, quantity: 50 },
      ],
    });
  });

  it('Flujo Completo Sección 72: Apertura (200) + Venta 1 (100: Cash 40, Yape 30, Credit 30) + Venta 2 (50: Cash 50) + Ingreso (20) - Retiro (10) = Esperado 300, Arqueo contado 298 -> Cierre Faltante -2', async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);

    // PASO 1: Apertura de Caja 01 con S/ 200.00
    const openSession = await cashService.openSession(
      {
        cashRegisterId: testRegister.id,
        storeId: testStore.id,
        openingCashAmount: 200,
        notes: 'Apertura turno principal',
      },
      testUser,
    );

    expect(openSession.status).toBe(CashSessionStatus.OPEN);
    expect(Number(openSession.openingCashAmount)).toBe(200);

    // Verify CashMovement OPENING
    const openingMov = await prisma.cashMovement.findFirst({
      where: { cashSessionId: openSession.id, type: CashMovementType.OPENING },
    });
    expect(openingMov).toBeDefined();
    expect(Number(openingMov?.amount)).toBe(200);
    expect(openingMov?.paymentMethod).toBe(SalePaymentMethod.CASH);

    // PASO 2: Venta 1: Total S/ 100
    // Polo (40) + Jean (60) = 100
    // CASH: 40, YAPE: 30, CREDIT: 30
    const sale1 = await salesService.createSale(
      {
        storeId: testStore.id,
        clientId: testClient.id,
        cashSessionId: openSession.id,
        items: [
          { productId: prodPolo.id, quantity: 1 },
          { productId: prodJean.id, quantity: 1 },
        ],
        payments: [
          { method: SalePaymentMethod.CASH, amount: 40 },
          { method: SalePaymentMethod.YAPE, amount: 30 },
          { method: SalePaymentMethod.CREDIT, amount: 30 },
        ],
      },
      testUser,
    );

    expect(sale1.id).toBeDefined();
    expect(sale1.cashSessionId).toBe(openSession.id);
    expect(sale1.receipt).toBeDefined();
    expect(sale1.receipt!.number).toMatch(/^B\d{3}-\d{6}$/);

    // Verify CashMovements for Sale 1: CASH +40, YAPE +30, NO CREDIT
    const sale1Movements = await prisma.cashMovement.findMany({
      where: { saleId: sale1.id },
      orderBy: { paymentMethod: 'asc' },
    });
    expect(sale1Movements.length).toBe(2);

    const cashMovSale1 = sale1Movements.find((m) => m.paymentMethod === SalePaymentMethod.CASH);
    expect(cashMovSale1).toBeDefined();
    expect(Number(cashMovSale1?.amount)).toBe(40);

    const yapeMovSale1 = sale1Movements.find((m) => m.paymentMethod === SalePaymentMethod.YAPE);
    expect(yapeMovSale1).toBeDefined();
    expect(Number(yapeMovSale1?.amount)).toBe(30);

    // Verify Client Debt for Credit purchase
    const clientAfterSale1 = await prisma.client.findUnique({
      where: { id: testClient.id },
    });
    expect(Number(clientAfterSale1?.dailyDebtBalance)).toBe(30);
    expect(Number(clientAfterSale1?.currentBalance)).toBe(30);

    // PASO 3: Venta 2: Total S/ 50 (CASH 50)
    // Gorra (50) = 50
    const sale2 = await salesService.createSale(
      {
        storeId: testStore.id,
        cashSessionId: openSession.id,
        items: [{ productId: prodGorra.id, quantity: 1 }],
        payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
      },
      testUser,
    );

    expect(sale2.id).toBeDefined();
    expect(sale2.receipt).toBeDefined();
    // Consecutive receipt number
    expect(sale2.receipt!.sequence).toBe(sale1.receipt!.sequence + 1);

    // PASO 4: Ingreso manual de efectivo +S/ 20
    const cashInRes = await cashService.addManualMovement(
      openSession.id,
      {
        type: 'CASH_IN',
        amount: 20,
        reason: 'Fondo adicional sencillo',
      },
      testUser,
    );
    expect(Number(cashInRes.movement.amount)).toBe(20);

    // PASO 5: Retiro manual de efectivo -S/ 10
    const cashOutRes = await cashService.addManualMovement(
      openSession.id,
      {
        type: 'CASH_OUT',
        amount: 10,
        reason: 'Pago de limpieza',
      },
      testUser,
    );
    expect(Number(cashOutRes.movement.amount)).toBe(-10);

    // PASO 6: Verificación de Resumen de Turno
    // Esperado efectivo: 200 + 40 (venta1) + 50 (venta2) + 20 (ingreso) - 10 (retiro) = 300
    // Yape: 30
    // Crédito: 30
    const summary = await cashService.calculateSessionSummary(openSession.id);
    expect(summary.openingCash).toBe(200);
    expect(summary.cashSales).toBe(90); // 40 + 50
    expect(summary.yapeSales).toBe(30);
    expect(summary.creditSales).toBe(30);
    expect(summary.cashIn).toBe(20);
    expect(summary.cashOut).toBe(10);
    expect(summary.expectedCashAmount).toBe(300);
    expect(summary.totalSalesAmount).toBe(150);
    expect(summary.salesCount).toBe(2);

    // PASO 7: Arqueo y Cierre de Caja
    // Efectivo contado: 298
    // Diferencia: 298 - 300 = -2 (Faltante)
    const closedSession = await cashService.closeSession(
      openSession.id,
      {
        countedCashAmount: 298,
        notes: 'Cierre turno con faltante de 2 soles',
      },
      testUser,
    );

    expect(closedSession.status).toBe(CashSessionStatus.CLOSED);
    expect(Number(closedSession.expectedCashAmount)).toBe(300);
    expect(Number(closedSession.countedCashAmount)).toBe(298);
    expect(Number(closedSession.differenceAmount)).toBe(-2);
    expect(closedSession.differenceType).toBe('FALTANTE');

    // PASO 8: Reimpresión de boleta de Venta 1
    const reprintedReceipt = await cashService.reprintReceipt(sale1.id, testUser);
    expect(reprintedReceipt.number).toBe(sale1.receipt!.number);
    expect(reprintedReceipt.reprintedCount).toBe(1);
    expect(reprintedReceipt.lastReprintedAt).toBeDefined();

    // =========================================================================
    // SECCIÓN 73: PRUEBA DE COBRANZA POSTERIOR
    // =========================================================================

    // 1. Abrir nueva sesión en Caja 01 con S/ 100
    const newSession = await cashService.openSession(
      {
        cashRegisterId: testRegister.id,
        storeId: testStore.id,
        openingCashAmount: 100,
        notes: 'Turno tarde',
      },
      testUser,
    );

    expect(newSession.status).toBe(CashSessionStatus.OPEN);

    // 2. Cliente paga S/ 20 de la deuda de Venta 1 en YAPE
    const debtPayment = await transactionsService.registerDailyDebtPayment(
      testClient.id,
      {
        amount: 20,
        paymentMethod: 'YAPE',
        cashSessionId: newSession.id,
        notes: 'Pago parcial de deuda vía Yape',
      },
      testUser,
    );

    expect(debtPayment.payment).toBeDefined();

    // Verify dailyDebt reduced: 30 - 20 = 10
    const clientAfterPayment = await prisma.client.findUnique({
      where: { id: testClient.id },
    });
    expect(Number(clientAfterPayment?.dailyDebtBalance)).toBe(10);
    expect(Number(clientAfterPayment?.currentBalance)).toBe(10);

    // Verify CashMovement DEBT_PAYMENT YAPE +20
    const debtMovement = await prisma.cashMovement.findFirst({
      where: {
        cashSessionId: newSession.id,
        type: CashMovementType.DEBT_PAYMENT,
      },
    });
    expect(debtMovement).toBeDefined();
    expect(Number(debtMovement?.amount)).toBe(20);
    expect(debtMovement?.paymentMethod).toBe(SalePaymentMethod.YAPE);

    // Verify physical cash in drawer remains exactly 100 (Yape did not affect drawer cash)
    const newSessionSummary = await cashService.calculateSessionSummary(newSession.id);
    expect(newSessionSummary.openingCash).toBe(100);
    expect(newSessionSummary.expectedCashAmount).toBe(100);
    expect(newSessionSummary.methodsSummary.YAPE).toBe(20);

    // =========================================================================
    // SECCIÓN 66.L: ANULACIÓN HISTÓRICA CON SESIÓN ORIGINAL CERRADA
    // =========================================================================
    // Anular Venta 2 (S/ 50 en CASH de la sesión cerrada anterior)
    const annulledSale2 = await salesService.annulSale(
      sale2.id,
      { reason: 'Cliente devolvió gorra defectuosa' },
      testUser,
    );

    expect(annulledSale2.status).toBe('ANULLED');

    // Reversal registered in current active session as SALE_REVERSAL of -50 CASH
    const reversalMov = await prisma.cashMovement.findFirst({
      where: {
        cashSessionId: newSession.id,
        type: CashMovementType.SALE_REVERSAL,
      },
    });
    expect(reversalMov).toBeDefined();
    expect(Number(reversalMov?.amount)).toBe(-50);
    expect(reversalMov?.paymentMethod).toBe(SalePaymentMethod.CASH);

    // Drawer cash in new session reduced by 50: 100 - 50 = 50
    const afterReversalSummary = await cashService.calculateSessionSummary(newSession.id);
    expect(afterReversalSummary.expectedCashAmount).toBe(50);
  });
});
