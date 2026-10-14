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
import { BalanceSyncService } from '../src/transactions/balance-sync.service';
import { cleanE2eDatabase, ensureE2eDatabase } from './setup-e2e-db';
import { SalePaymentMethod, Prisma } from '@prisma/client';

describe('ETAPA 2 — Sección 64: Prueba Integrada Crítica POS + Inventario + Deuda', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let salesService: SalesService;
  let balanceSyncService: BalanceSyncService;
  let testUser: any;

  beforeAll(async () => {
    // Validate anti-production guard
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
    balanceSyncService = app.get(BalanceSyncService);
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);
    await cleanE2eDatabase();
  });

  it('Escenario Sección 64: Tienda Centro, Prod A (10->8), Prod B (5->4), Cliente dailyDebt 100->130, bankDebt 500 intacto, Sale total 50 (Cash 20, Credit 30)', async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);

    // 1. Setup User
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await prisma.user.upsert({
      where: { email: 'cajero.critico@test.com' },
      update: {},
      create: {
        name: 'Cajero Prueba Crítica',
        email: 'cajero.critico@test.com',
        password: hashedPassword,
        role: 'Cajero',
        active: true,
        approved: true,
      },
    });

    const timestamp = Date.now();

    // 2. Setup Tienda Centro
    const store = await prisma.location.create({
      data: {
        name: `Tienda Centro Test ${timestamp}`,
        code: `TC-${timestamp}`,
        type: 'STORE',
        active: true,
      },
    });

    // 3. Setup Producto A (salePrice: 20) and Producto B (salePrice: 10)
    const productA = await prisma.product.create({
      data: {
        name: `Producto A Test ${timestamp}`,
        sku: `PRD-A-${timestamp}`,
        saleType: 'UNIT',
        salePrice: 20.0,
        costPrice: 12.0,
        tracksInventory: true,
        active: true,
      },
    });

    const productB = await prisma.product.create({
      data: {
        name: `Producto B Test ${timestamp}`,
        sku: `PRD-B-${timestamp}`,
        saleType: 'UNIT',
        salePrice: 10.0,
        costPrice: 6.0,
        tracksInventory: true,
        active: true,
      },
    });

    // Initial stock: Prod A = 10, Prod B = 5 in Tienda Centro
    await prisma.inventoryStock.create({
      data: {
        locationId: store.id,
        productId: productA.id,
        quantity: 10,
        minimumStock: 2,
      },
    });

    await prisma.inventoryStock.create({
      data: {
        locationId: store.id,
        productId: productB.id,
        quantity: 5,
        minimumStock: 2,
      },
    });

    // 4. Setup Cliente con dailyDebt = 100 y bankDebt = 500
    const client = await prisma.client.create({
      data: {
        clientNumber: `CLI-${Date.now()}`,
        name: 'Cliente Prueba Crítica',
        creditLimit: 1000.0,
        currentBalance: 600.0,
        dailyDebtBalance: 100.0,
        bankDebtBalance: 500.0,
        status: 'Activo',
      },
    });

    // Seed historical base so balanceSyncService reflects the 100 dailyDebt and 500 bankDebt
    await prisma.creditPurchase.create({
      data: {
        clientId: client.id,
        product: 'Deuda Corriente Inicial',
        unitPrice: 100.0,
        quantity: 1,
        amount: 100.0,
        registeredBy: 'Admin',
      },
    });

    await prisma.loan.create({
      data: {
        code: `LN-${Date.now()}`,
        clientId: client.id,
        capital: 500.0,
        interestRate: 0,
        interestAmount: 0,
        totalAmount: 500.0,
        installmentsCount: 1,
        installmentAmount: 500.0,
        frequency: 'Mensual',
        firstDueDate: '2026-12-31',
        pendingAmount: 500.0,
        registeredBy: 'Admin',
      },
    });

    // Verify initial balance sync
    await balanceSyncService.syncClientBalances(client.id);
    const initialClient = await prisma.client.findUnique({
      where: { id: client.id },
    });
    expect(Number(initialClient!.dailyDebtBalance)).toBe(100.0);
    expect(Number(initialClient!.bankDebtBalance)).toBe(500.0);
    expect(Number(initialClient!.currentBalance)).toBe(600.0);

    // Setup CashRegister and Open Session for Store (ETAPA 3 requirement)
    const register = await prisma.cashRegister.create({
      data: {
        storeId: store.id,
        code: 'CAJA-E2E',
        name: 'Caja E2E',
        status: 'ACTIVE',
      },
    });

    await prisma.cashSession.create({
      data: {
        cashRegisterId: register.id,
        storeId: store.id,
        openedByUserId: testUser.id,
        openingCashAmount: new Prisma.Decimal(100),
        status: 'OPEN',
      },
    });

    // 5. Execute POS Sale:
    // Producto A: 2 x 20 = 40
    // Producto B: 1 x 10 = 10
    // TOTAL: 50
    // Pago: Efectivo 20, Crédito 30
    const saleResult = await salesService.createSale(
      {
        storeId: store.id,
        clientId: client.id,
        items: [
          { productId: productA.id, quantity: 2 },
          { productId: productB.id, quantity: 1 },
        ],
        payments: [
          { method: SalePaymentMethod.CASH, amount: 20.0 },
          { method: SalePaymentMethod.CREDIT, amount: 30.0 },
        ],
        cashReceived: 20.0,
      },
      testUser,
    );

    // 6. Verify Sale Entity
    expect(saleResult).toBeDefined();
    expect(Number(saleResult.total)).toBe(50.0);
    expect(Number(saleResult.subtotal)).toBe(50.0);
    expect(saleResult.items.length).toBe(2);
    expect(saleResult.payments.length).toBe(2);

    // 7. Verify Inventory Stocks
    // Product A stock: 10 - 2 = 8
    const stockA = await prisma.inventoryStock.findUnique({
      where: {
        locationId_productId: {
          locationId: store.id,
          productId: productA.id,
        },
      },
    });
    expect(Number(stockA!.quantity)).toBe(8);

    // Product B stock: 5 - 1 = 4
    const stockB = await prisma.inventoryStock.findUnique({
      where: {
        locationId_productId: {
          locationId: store.id,
          productId: productB.id,
        },
      },
    });
    expect(Number(stockB!.quantity)).toBe(4);

    // 8. Verify Inventory Movements
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        referenceType: 'SALE',
        referenceId: saleResult.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.length).toBe(2);

    const movA = movements.find((m) => m.productId === productA.id);
    expect(movA).toBeDefined();
    expect(Number(movA!.quantity)).toBe(-2);
    expect(Number(movA!.previousStock)).toBe(10);
    expect(Number(movA!.newStock)).toBe(8);

    const movB = movements.find((m) => m.productId === productB.id);
    expect(movB).toBeDefined();
    expect(Number(movB!.quantity)).toBe(-1);
    expect(Number(movB!.previousStock)).toBe(5);
    expect(Number(movB!.newStock)).toBe(4);

    // 9. Verify Client Accounting & Balances
    const updatedClient = await prisma.client.findUnique({
      where: { id: client.id },
    });

    // dailyDebt = 130 (100 + 30)
    expect(Number(updatedClient!.dailyDebtBalance)).toBe(130.0);

    // bankDebt = 500 (remains intact)
    expect(Number(updatedClient!.bankDebtBalance)).toBe(500.0);

    // currentBalance increases by 30 (600 + 30 = 630)
    expect(Number(updatedClient!.currentBalance)).toBe(630.0);

    // Invariant: currentBalance = dailyDebtBalance + bankDebtBalance
    expect(Number(updatedClient!.currentBalance)).toBe(
      Number(updatedClient!.dailyDebtBalance) +
        Number(updatedClient!.bankDebtBalance),
    );

    // 10. Verify SalePayments in DB
    const dbPayments = await prisma.salePayment.findMany({
      where: { saleId: saleResult.id },
    });
    expect(dbPayments.length).toBe(2);

    const cashPay = dbPayments.find((p) => p.method === 'CASH');
    expect(cashPay).toBeDefined();
    expect(Number(cashPay!.amount)).toBe(20.0);

    const creditPay = dbPayments.find((p) => p.method === 'CREDIT');
    expect(creditPay).toBeDefined();
    expect(Number(creditPay!.amount)).toBe(30.0);

    // 11. Anulación atómica de la venta (Requisitos 36, 38)
    const annulResult = await salesService.annulSale(
      saleResult.id,
      { reason: 'Cliente canceló el pedido en caja' },
      testUser,
    );
    expect(annulResult.status).toBe('ANULLED');

    // Restores Product A stock from 8 back to 10
    const restoredStockA = await prisma.inventoryStock.findUnique({
      where: {
        locationId_productId: {
          locationId: store.id,
          productId: productA.id,
        },
      },
    });
    expect(Number(restoredStockA!.quantity)).toBe(10);

    // Restores Product B stock from 4 back to 5
    const restoredStockB = await prisma.inventoryStock.findUnique({
      where: {
        locationId_productId: {
          locationId: store.id,
          productId: productB.id,
        },
      },
    });
    expect(Number(restoredStockB!.quantity)).toBe(5);

    // Reverses dailyDebt from 130 back to 100
    const annulledClient = await prisma.client.findUnique({
      where: { id: client.id },
    });
    expect(Number(annulledClient!.dailyDebtBalance)).toBe(100.0);
    expect(Number(annulledClient!.bankDebtBalance)).toBe(500.0);
    expect(Number(annulledClient!.currentBalance)).toBe(600.0);

    // Creates SALE_REVERSAL movements
    const reversalMovements = await prisma.inventoryMovement.findMany({
      where: {
        referenceType: 'SALE_REVERSAL',
        referenceId: saleResult.id,
      },
    });
    expect(reversalMovements.length).toBe(2);
  });

  it('Rollback atómico ante fallo: Si pagos no cuadran o cliente no existe, nada se persiste', async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);

    const timestamp = Date.now();
    const store = await prisma.location.create({
      data: {
        name: `Tienda Rollback ${timestamp}`,
        code: `TR-${timestamp}`,
        type: 'STORE',
        active: true,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Prod Rollback ${timestamp}`,
        sku: `PR-RB-${timestamp}`,
        salePrice: 50.0,
        tracksInventory: true,
        active: true,
      },
    });

    await prisma.inventoryStock.create({
      data: {
        locationId: store.id,
        productId: product.id,
        quantity: 10,
      },
    });

    // Attempt sale with mismatched payment: Total 50, but paid 40
    await expect(
      salesService.createSale(
        {
          storeId: store.id,
          items: [{ productId: product.id, quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 40.0 }],
        },
        testUser,
      ),
    ).rejects.toThrow();

    // Verify stock is still 10 (untouched)
    const stock = await prisma.inventoryStock.findUnique({
      where: {
        locationId_productId: {
          locationId: store.id,
          productId: product.id,
        },
      },
    });
    expect(Number(stock!.quantity)).toBe(10);

    // No sales created
    const salesCount = await prisma.sale.count({
      where: { storeId: store.id },
    });
    expect(salesCount).toBe(0);

    // No movements created
    const movementsCount = await prisma.inventoryMovement.count({
      where: { locationId: store.id },
    });
    expect(movementsCount).toBe(0);
  });
});
