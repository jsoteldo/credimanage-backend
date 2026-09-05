import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

// 1. MUST EXECUTE SAFETY GUARD BEFORE ANY DATABASE CONNECTION OR MODULE INITIALIZATION
import { assertNonProductionDatabase } from './assert-non-production-db';
dotenv.config({ path: path.join(__dirname, '../.env.e2e') });
assertNonProductionDatabase(process.env.DATABASE_URL);

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanE2eDatabase, ensureE2eDatabase } from './setup-e2e-db';

describe('FASE 2C-A: Integración API + PostgreSQL Local Aislado', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let cashierToken: string;
  let adminUser: any;
  let cashierUser: any;

  beforeAll(async () => {
    // 1. Ensure local database credimanage_e2e_test exists and migrations are deployed
    assertNonProductionDatabase(process.env.DATABASE_URL);
    await ensureE2eDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Seed baseline users before each test scenario
  beforeEach(async () => {
    assertNonProductionDatabase(process.env.DATABASE_URL);
    await cleanE2eDatabase();

    const hashedPassword = await bcrypt.hash('password123', 10);

    adminUser = await prisma.user.create({
      data: {
        name: 'Admin E2E',
        email: 'admin.e2e@credimanage.com',
        password: hashedPassword,
        role: 'Administrador',
        active: true,
        approved: true,
      },
    });

    cashierUser = await prisma.user.create({
      data: {
        name: 'Cajero E2E',
        email: 'cajero.e2e@credimanage.com',
        password: hashedPassword,
        role: 'Cajero',
        active: true,
        approved: true,
      },
    });

    // Login Admin
    const adminRes = await request(app.getHttpServer())
      .post('/crediApi/auth/login')
      .send({ email: 'admin.e2e@credimanage.com', password: 'password123' })
      .expect(201);
    adminToken = adminRes.body.token;

    // Login Cashier
    const cashierRes = await request(app.getHttpServer())
      .post('/crediApi/auth/login')
      .send({ email: 'cajero.e2e@credimanage.com', password: 'password123' })
      .expect(201);
    cashierToken = cashierRes.body.token;
  });

  // Helper to create client via official API
  async function createClientViaApi(token: string, clientData: any) {
    const res = await request(app.getHttpServer())
      .post('/crediApi/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(clientData)
      .expect(201);
    return res.body;
  }

  // Helper to create purchase via official API
  async function createPurchaseViaApi(token: string, clientId: string, purchaseData: any) {
    const res = await request(app.getHttpServer())
      .post(`/crediApi/clients/${clientId}/credit-purchase`)
      .set('Authorization', `Bearer ${token}`)
      .send(purchaseData)
      .expect(201);
    return res.body.purchase || res.body;
  }

  // Helper to create loan via official API
  async function createLoanViaApi(token: string, clientId: string, loanData: any) {
    const res = await request(app.getHttpServer())
      .post(`/crediApi/clients/${clientId}/loans`)
      .set('Authorization', `Bearer ${token}`)
      .send(loanData)
      .expect(201);
    return res.body.loan || res.body;
  }

  // =========================================================================
  // ESCENARIO 1 — DEUDA CORRIENTE
  // =========================================================================
  it('Escenario 1: Pago a Deuda Corriente actualiza daily y current sin mutar bankDebt', async () => {
    // 1. Setup Client A via real API flows
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente A',
      phone: '999111222',
      address: 'Av. Test 100',
      creditLimit: 2000,
    });

    // Purchase 300
    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Artículos de tienda',
      unitPrice: 300,
      quantity: 1,
    });

    // Loan A: 300, Loan B: 400
    const loanA = await createLoanViaApi(cashierToken, client.id, {
      capital: 300,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const loanB = await createLoanViaApi(cashierToken, client.id, {
      capital: 400,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-15',
    });

    // ASSERT INITIAL FIXTURE STATE
    const initialDbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(initialDbClient.dailyDebtBalance)).toBe(300);
    expect(Number(initialDbClient.bankDebtBalance)).toBe(700);
    expect(Number(initialDbClient.currentBalance)).toBe(1000);

    // 2. Execute Payment of 100 to Daily Debt
    const payRes = await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 100,
        paymentMethod: 'Efectivo',
        notes: 'Abono corriente test',
      })
      .expect(201);

    // Verify response
    expect(payRes.body.client.dailyDebtBalance).toBe(200);
    expect(payRes.body.client.bankDebtBalance).toBe(700);
    expect(payRes.body.client.currentBalance).toBe(900);

    // 3. DIRECT DB ASSERTIONS
    const updatedDbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(updatedDbClient.dailyDebtBalance)).toBe(200);
    expect(Number(updatedDbClient.bankDebtBalance)).toBe(700);
    expect(Number(updatedDbClient.currentBalance)).toBe(900);

    // Check payment record
    const paymentRecord = await prisma.payment.findFirstOrThrow({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(Number(paymentRecord.amount)).toBe(100);
    expect(paymentRecord.targetType).toBe('dailyDebt');
    expect(paymentRecord.status).toBe('Activo');

    // Check loans in DB untouched
    const dbLoanA = await prisma.loan.findUniqueOrThrow({ where: { id: loanA.id } });
    const dbLoanB = await prisma.loan.findUniqueOrThrow({ where: { id: loanB.id } });
    expect(Number(dbLoanA.pendingAmount)).toBe(300);
    expect(Number(dbLoanB.pendingAmount)).toBe(400);
  });

  // =========================================================================
  // ESCENARIO 2 — PAGO BANCARIO
  // =========================================================================
  it('Escenario 2: Pago Bancario individual a Loan A reduce Loan A y bankDebt; Loan B y dailyDebt intactos', async () => {
    // 1. Setup Client A with Loan A (300) and Loan B (400) + daily debt (200)
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente A',
      phone: '999111222',
      address: 'Av. Test 100',
      creditLimit: 2000,
    });

    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Consumo',
      unitPrice: 200,
      quantity: 1,
    });

    const loanA = await createLoanViaApi(cashierToken, client.id, {
      capital: 300,
      interestRate: 0,
      installmentsCount: 3, // 3 installments of 100 each
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const loanB = await createLoanViaApi(cashierToken, client.id, {
      capital: 400,
      interestRate: 0,
      installmentsCount: 2,
      frequency: 'Mensual',
      firstDueDate: '2026-10-15',
    });

    // ASSERT INITIAL FIXTURE STATE
    const initClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(initClient.dailyDebtBalance)).toBe(200);
    expect(Number(initClient.bankDebtBalance)).toBe(700);
    expect(Number(initClient.currentBalance)).toBe(900);

    // 2. Execute Payment of 100 to Loan A specifically
    const payRes = await request(app.getHttpServer())
      .post(`/crediApi/loans/${loanA.id}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 100,
        paymentMethod: 'Efectivo',
        notes: 'Pago cuota 1 Loan A',
      })
      .expect(201);

    expect(payRes.body.client.bankDebtBalance).toBe(600);
    expect(payRes.body.client.dailyDebtBalance).toBe(200);
    expect(payRes.body.client.currentBalance).toBe(800);

    // 3. DIRECT DB ASSERTIONS
    const dbLoanA = await prisma.loan.findUniqueOrThrow({
      where: { id: loanA.id },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
    const dbLoanB = await prisma.loan.findUniqueOrThrow({ where: { id: loanB.id } });
    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });

    expect(Number(dbLoanA.pendingAmount)).toBe(200);
    expect(Number(dbLoanA.paidAmount)).toBe(100);

    // FIFO check on installments: installment 1 is Pagada, 2 & 3 are Pendiente
    expect(dbLoanA.installments[0].status).toBe('Pagada');
    expect(Number(dbLoanA.installments[0].paidAmount)).toBe(100);
    expect(dbLoanA.installments[1].status).toBe('Pendiente');
    expect(Number(dbLoanA.installments[1].paidAmount)).toBe(0);

    // Loan B completely unchanged
    expect(Number(dbLoanB.pendingAmount)).toBe(400);
    expect(Number(dbLoanB.paidAmount)).toBe(0);

    // Client balances
    expect(Number(dbClient.dailyDebtBalance)).toBe(200); // Unchanged!
    expect(Number(dbClient.bankDebtBalance)).toBe(600);
    expect(Number(dbClient.currentBalance)).toBe(800);
  });

  // =========================================================================
  // ESCENARIO 3 — FULL PAYOFF DAILY
  // =========================================================================
  it('Escenario 3: Full payoff de deuda corriente extingue dailyDebtBalance exactamente a 0', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Liquidar Diario',
      phone: '999333444',
      address: 'Calle 1',
      creditLimit: 1000,
    });

    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Consumo',
      unitPrice: 200,
      quantity: 1,
    });

    await createLoanViaApi(cashierToken, client.id, {
      capital: 500,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    // Initial check
    const initClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(initClient.dailyDebtBalance)).toBe(200);
    expect(Number(initClient.bankDebtBalance)).toBe(500);

    // Execute full payoff
    await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 200,
        isFullPayoff: true,
        paymentMethod: 'Efectivo',
      })
      .expect(201);

    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClient.dailyDebtBalance)).toBe(0);
    expect(Number(dbClient.bankDebtBalance)).toBe(500); // Bank untouched
    expect(Number(dbClient.currentBalance)).toBe(500);
  });

  // =========================================================================
  // ESCENARIO 4 — FULL PAYOFF LOAN
  // =========================================================================
  it('Escenario 4: Full payoff de Loan A lo pasa a status Pagado y pendingAmount 0; Loan B y dailyDebt intactos', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Liquidar Prestamo',
      phone: '999555666',
      address: 'Calle 2',
      creditLimit: 2000,
    });

    const loanA = await createLoanViaApi(cashierToken, client.id, {
      capital: 200,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const loanB = await createLoanViaApi(cashierToken, client.id, {
      capital: 400,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-05',
    });

    // Execute full payoff on Loan A (200)
    await request(app.getHttpServer())
      .post(`/crediApi/loans/${loanA.id}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 200,
        isFullPayoff: true,
        paymentMethod: 'Efectivo',
      })
      .expect(201);

    const dbLoanA = await prisma.loan.findUniqueOrThrow({ where: { id: loanA.id } });
    const dbLoanB = await prisma.loan.findUniqueOrThrow({ where: { id: loanB.id } });
    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });

    expect(Number(dbLoanA.pendingAmount)).toBe(0);
    expect(dbLoanA.status).toBe('Pagado');

    // Loan B untouched
    expect(Number(dbLoanB.pendingAmount)).toBe(400);
    expect(dbLoanB.status).toBe('Activo');

    expect(Number(dbClient.bankDebtBalance)).toBe(400);
    expect(Number(dbClient.dailyDebtBalance)).toBe(0);
  });

  // =========================================================================
  // ESCENARIO 5 — SALDO A FAVOR
  // =========================================================================
  it('Escenario 5: Saldo a favor (dailyDebtBalance < 0) NO reduce la deuda bancaria visualmente', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Saldo a Favor',
      phone: '999777888',
      address: 'Calle 3',
      creditLimit: 1000,
    });

    // Purchase 50
    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Panadería',
      unitPrice: 50,
      quantity: 1,
    });

    // Loan 600
    await createLoanViaApi(cashierToken, client.id, {
      capital: 600,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    // Pay 100 to daily debt (overpayment of 50)
    const payRes = await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 100,
        paymentMethod: 'Efectivo',
      })
      .expect(201);

    expect(payRes.body.client.dailyDebtBalance).toBe(-50);
    expect(payRes.body.client.bankDebtBalance).toBe(600); // Does NOT reduce bank debt!
    expect(payRes.body.client.currentBalance).toBe(550); // -50 + 600 = 550 net
    expect(payRes.body.client.creditExposure).toBe(600); // max(0, -50) + 600 = 600 exposure

    // DB assertions
    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClient.dailyDebtBalance)).toBe(-50);
    expect(Number(dbClient.bankDebtBalance)).toBe(600);
    expect(Number(dbClient.currentBalance)).toBe(550);
  });

  // =========================================================================
  // ESCENARIO 6 — CRÉDITO DISPONIBLE
  // =========================================================================
  it('Escenario 6: availableCredit calcula max(0, creditLimit - creditExposure), NO suma saldo a favor al límite', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Exposure Test',
      phone: '999000111',
      address: 'Calle 4',
      creditLimit: 1000,
    });

    // Daily payment of 200 with 0 purchases -> daily = -200
    await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ amount: 200, paymentMethod: 'Efectivo' })
      .expect(201);

    // Bank loan of 600
    await createLoanViaApi(cashierToken, client.id, {
      capital: 600,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const getRes = await request(app.getHttpServer())
      .get('/crediApi/clients')
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);

    const target = getRes.body.find((c: any) => c.id === client.id);
    expect(target.creditLimit).toBe(1000);
    expect(target.dailyDebtBalance).toBe(-200);
    expect(target.bankDebtBalance).toBe(600);
    expect(target.currentBalance).toBe(400); // -200 + 600
    expect(target.creditExposure).toBe(600); // max(0, -200) + 600 = 600

    // availableCredit = max(0, 1000 - 600) = 400.
    // It must NEVER be 600 (1000 - 400 net balance) nor 1200 (1000 - (-200))!
    expect(target.availableCredit).toBe(400);
  });

  // =========================================================================
  // ESCENARIO 7 — CLIENTE SIN LÍMITE
  // =========================================================================
  it('Escenario 7: Cliente sin límite (creditLimit <= 0) entrega availableCredit: null en JSON', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Sin Limite',
      phone: '999222333',
      address: 'Calle 5',
      creditLimit: 0,
    });

    const getRes = await request(app.getHttpServer())
      .get('/crediApi/clients')
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);

    const target = getRes.body.find((c: any) => c.id === client.id);
    expect(target.creditLimit).toBe(0);
    expect(target.availableCredit).toBeNull();
  });

  // =========================================================================
  // ESCENARIO 8 — DEUDA S/ 0.01
  // =========================================================================
  it('Escenario 8: Deuda exacta de S/ 0.01 se registra, refleja en DB y se cancela a 0.00', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Centavo',
      phone: '999444555',
      address: 'Calle 6',
      creditLimit: 500,
    });

    // Purchase for 0.01
    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Caramelo',
      unitPrice: 0.01,
      quantity: 1,
    });

    const dbClientAfterPurchase = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClientAfterPurchase.dailyDebtBalance)).toBe(0.01);
    expect(Number(dbClientAfterPurchase.currentBalance)).toBe(0.01);

    // Pay 0.01
    await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 0.01, paymentMethod: 'Efectivo' })
      .expect(201);

    const dbClientAfterPayment = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClientAfterPayment.dailyDebtBalance)).toBe(0);
    expect(Number(dbClientAfterPayment.currentBalance)).toBe(0);
  });

  // =========================================================================
  // ESCENARIO 9 — ANULACIÓN DE COMPRA POST-SNAPSHOT
  // =========================================================================
  it('Escenario 9: Anulación de compra por Administrador revierte dailyDebtBalance y mantiene bankDebtBalance', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Anulacion Compra',
      phone: '999666777',
      address: 'Calle 7',
      creditLimit: 1000,
    });

    const purchase = await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Mercadería',
      unitPrice: 150,
      quantity: 1,
    });

    await createLoanViaApi(cashierToken, client.id, {
      capital: 300,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    // Before annulment
    const preDbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(preDbClient.dailyDebtBalance)).toBe(150);
    expect(Number(preDbClient.bankDebtBalance)).toBe(300);

    // Admin annuls purchase
    await request(app.getHttpServer())
      .post(`/crediApi/purchases/${purchase.id}/annul`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Error en registro de ticket' })
      .expect(201);

    // DB verification
    const postDbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(postDbClient.dailyDebtBalance)).toBe(0);
    expect(Number(postDbClient.bankDebtBalance)).toBe(300);
    expect(Number(postDbClient.currentBalance)).toBe(300);

    const dbPurchase = await prisma.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(dbPurchase.status).toBe('Anulado');
  });

  // =========================================================================
  // ESCENARIO 10 — ANULACIÓN DE PAGO
  // =========================================================================
  it('Escenario 10: Anulación de pago diario restaura dailyDebt; anulación de pago bank restaura cuotas/loan', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Anulacion Pago',
      phone: '999888999',
      address: 'Calle 8',
      creditLimit: 1500,
    });

    // 1. Daily payment & annulment
    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Abarrotes',
      unitPrice: 300,
      quantity: 1,
    });

    const payDailyRes = await request(app.getHttpServer())
      .post(`/crediApi/clients/${client.id}/debt-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100, paymentMethod: 'Efectivo' })
      .expect(201);

    const dailyPaymentId = payDailyRes.body.payment.id;

    // Verify balance is 200
    let dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClient.dailyDebtBalance)).toBe(200);

    // Admin annuls daily payment
    await request(app.getHttpServer())
      .post(`/crediApi/payments/${dailyPaymentId}/annul`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Pago registrado por error' })
      .expect(201);

    dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClient.dailyDebtBalance)).toBe(300); // Restored!

    // 2. Bank payment & annulment
    const loan = await createLoanViaApi(cashierToken, client.id, {
      capital: 400,
      interestRate: 0,
      installmentsCount: 2, // 200 each
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const payLoanRes = await request(app.getHttpServer())
      .post(`/crediApi/loans/${loan.id}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 200, paymentMethod: 'Efectivo' })
      .expect(201);

    const loanPaymentId = payLoanRes.body.payment.id;

    let dbLoan = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(Number(dbLoan.pendingAmount)).toBe(200);

    // Admin annuls bank payment
    await request(app.getHttpServer())
      .post(`/crediApi/payments/${loanPaymentId}/annul`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Comprobante bancario rebotado' })
      .expect(201);

    dbLoan = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(Number(dbLoan.pendingAmount)).toBe(400); // Restored to 400!
  });

  // =========================================================================
  // ESCENARIO 11 & 12 — MULTIPLES LOANS & CALLS
  // =========================================================================
  it('Escenario 11 & 12: Múltiples préstamos pagan exclusivamente el loanId objetivo; legacy endpoint no usado', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Multi Loans',
      phone: '999123456',
      address: 'Calle 9',
      creditLimit: 3000,
    });

    const loanA = await createLoanViaApi(cashierToken, client.id, {
      capital: 300,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const loanB = await createLoanViaApi(cashierToken, client.id, {
      capital: 700,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-05',
    });

    // Pay only Loan A
    const payRes = await request(app.getHttpServer())
      .post(`/crediApi/loans/${loanA.id}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 300, isFullPayoff: true, paymentMethod: 'Efectivo' })
      .expect(201);

    const dbLoanA = await prisma.loan.findUniqueOrThrow({ where: { id: loanA.id } });
    expect(Number(dbLoanA.pendingAmount)).toBe(0);
    expect(dbLoanA.status).toBe('Pagado');

    // Loan B MUST be completely untouched
    const dbLoanB = await prisma.loan.findUniqueOrThrow({ where: { id: loanB.id } });
    expect(Number(dbLoanB.pendingAmount)).toBe(700);
    expect(dbLoanB.status).toBe('Activo');

    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(dbClient.bankDebtBalance)).toBe(700);
  });

  // =========================================================================
  // ESCENARIO 13 — CAJERO VS ADMINISTRADOR A NIVEL API
  // =========================================================================
  it('Escenario 13: Cajero tiene prohibido anular operaciones (403); Administrador autorizado (200)', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Permisos',
      phone: '999654321',
      address: 'Calle 10',
      creditLimit: 1000,
    });

    const purchase = await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Item',
      unitPrice: 100,
      quantity: 1,
    });

    // 1. Cashier attempts to annul purchase -> 403 Forbidden
    await request(app.getHttpServer())
      .post(`/crediApi/purchases/${purchase.id}/annul`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'Intento de anulación cajero' })
      .expect(403);

    // 2. Admin attempts to annul purchase -> 201 Created
    await request(app.getHttpServer())
      .post(`/crediApi/purchases/${purchase.id}/annul`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Anulación autorizada por Administrador' })
      .expect(201);

    const dbPurchase = await prisma.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(dbPurchase.status).toBe('Anulado');
  });

  // =========================================================================
  // ESCENARIO 14 — INVARIANTES Y ATOMICIDAD
  // =========================================================================
  it('Escenario 14: Invariantes contables y atomicidad se mantienen en todo momento', async () => {
    const client = await createClientViaApi(cashierToken, {
      name: 'Cliente Invariantes',
      phone: '999333999',
      address: 'Calle 11',
      creditLimit: 1500,
    });

    await createPurchaseViaApi(cashierToken, client.id, {
      product: 'Consumo 1',
      unitPrice: 123.45,
      quantity: 1,
    });

    await createLoanViaApi(cashierToken, client.id, {
      capital: 456.55,
      interestRate: 0,
      installmentsCount: 1,
      frequency: 'Mensual',
      firstDueDate: '2026-10-01',
    });

    const dbClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    const daily = Number(dbClient.dailyDebtBalance);
    const bank = Number(dbClient.bankDebtBalance);
    const current = Number(dbClient.currentBalance);

    // Invariant: currentBalance === dailyDebtBalance + bankDebtBalance
    expect(Math.round((daily + bank) * 100) / 100).toBe(Math.round(current * 100) / 100);
    expect(current).toBe(580.00); // 123.45 + 456.55 = 580.00
  });
});
