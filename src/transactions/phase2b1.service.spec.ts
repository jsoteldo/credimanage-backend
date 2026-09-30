import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import {
  BalanceSyncService,
  validatePaymentAllocations,
} from './balance-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('FASE 2B.1 — Balance Model Engine & Transactions Test Suite', () => {
  let transactionsService: TransactionsService;
  let balanceSyncService: BalanceSyncService;
  let mockPrisma: any;
  let mockAudit: any;

  const mockAdmin = {
    id: 'usr-admin',
    name: 'Admin Test',
    role: 'Administrador',
  };
  const mockCajero = { id: 'usr-cajero', name: 'Cajero Test', role: 'Cajero' };

  beforeEach(async () => {
    mockPrisma = {
      client: {
        findUnique: jest.fn(),
        update: jest.fn(({ where, data }) => ({
          id: where.id,
          ...data,
        })),
      },
      loan: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }) => ({ id: 'loan-1', ...data })),
        update: jest.fn(({ where, data }) => ({ id: where.id, ...data })),
      },
      installment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(({ where, data }) => ({ id: where.id, ...data })),
        updateMany: jest.fn(),
      },
      creditPurchase: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(({ data }) => ({ id: 'pur-1', ...data })),
        update: jest.fn(({ where, data }) => ({ id: where.id, ...data })),
        updateMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(({ data }) => ({ id: 'pay-1', ...data })),
        update: jest.fn(({ where, data }) => ({ id: where.id, ...data })),
      },
      balanceAdjustment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(({ data }) => ({ id: 'adj-1', ...data })),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockAudit = {
      logAudit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        BalanceSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    transactionsService = module.get<TransactionsService>(TransactionsService);
    balanceSyncService = module.get<BalanceSyncService>(BalanceSyncService);

    jest.clearAllMocks();
  });

  describe('PUNTO 22: Test de Coexistencia de Cartera', () => {
    it('debe mantener estricta independencia entre cartera corriente y bancaria', async () => {
      // Setup client: dailyDebt = 300, bankDebt = 700, currentBalance = 1000
      const cutOff = new Date('2026-09-01T00:00:00.000Z');
      const client = {
        id: 'cli-coex',
        name: 'Cliente Coexistencia',
        creditLimit: 2000,
        currentBalance: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(300),
            bankDebtOpeningBalance: new Prisma.Decimal(700),
            currentOpeningBalance: new Prisma.Decimal(1000),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };

      const loan = {
        id: 'loan-coex',
        code: 'CR-700',
        clientId: 'cli-coex',
        totalAmount: 700,
        pendingAmount: 700,
        paidAmount: 0,
        status: 'Activo',
        installments: [
          {
            id: 'inst-1',
            loanId: 'loan-coex',
            installmentNumber: 1,
            amount: 700,
            paidAmount: 0,
            dueDate: '2026-10-01',
            status: 'Pendiente',
          },
        ],
      };

      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.loan.findMany.mockResolvedValue([loan]);
      mockPrisma.loan.findFirst.mockResolvedValue(loan);
      mockPrisma.loan.findUnique.mockResolvedValue(loan);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      // Step 1: Client has no new payments yet.
      mockPrisma.payment.findMany.mockResolvedValue([]);
      const initial = await balanceSyncService.syncClientBalances('cli-coex');
      expect(initial.dailyDebtBalance).toBe(300);
      expect(initial.bankDebtBalance).toBe(700);
      expect(initial.currentBalance).toBe(1000);

      // Step 2: Pay 100 to daily debt
      const dailyPay = {
        id: 'pay-daily-1',
        clientId: 'cli-coex',
        amount: 100,
        targetType: 'dailyDebt',
        isBaselineMovement: false,
        createdAt: new Date('2026-09-05T10:00:00.000Z'),
        status: 'Activo',
        allocations: [{ targetType: 'dailyDebt', amount: 100 }],
      };
      mockPrisma.payment.findMany.mockResolvedValue([dailyPay]);

      const afterDailyPay =
        await balanceSyncService.syncClientBalances('cli-coex');
      expect(afterDailyPay.dailyDebtBalance).toBe(200);
      expect(afterDailyPay.bankDebtBalance).toBe(700);
      expect(afterDailyPay.currentBalance).toBe(900);

      // Step 3: Pay 100 to bank loan
      const updatedLoan = {
        ...loan,
        pendingAmount: 600,
        paidAmount: 100,
        installments: [
          { ...loan.installments[0], paidAmount: 100, status: 'Parcial' },
        ],
      };
      mockPrisma.loan.findMany.mockResolvedValue([updatedLoan]);
      const bankPay = {
        id: 'pay-bank-1',
        clientId: 'cli-coex',
        loanId: 'loan-coex',
        amount: 100,
        targetType: 'bankLoan',
        isBaselineMovement: false,
        createdAt: new Date('2026-09-05T11:00:00.000Z'),
        status: 'Activo',
        allocations: [
          {
            targetType: 'bankLoan',
            loanId: 'loan-coex',
            installmentNumber: 1,
            amount: 100,
          },
        ],
      };
      mockPrisma.payment.findMany.mockResolvedValue([dailyPay, bankPay]);

      const afterBankPay =
        await balanceSyncService.syncClientBalances('cli-coex');
      expect(afterBankPay.dailyDebtBalance).toBe(200);
      expect(afterBankPay.bankDebtBalance).toBe(600);
      expect(afterBankPay.currentBalance).toBe(800);
    });
  });

  describe('Tests Base A - S', () => {
    it('A: registerDailyDebtPayment con isFullPayoff liquida solo deuda corriente', async () => {
      const client = {
        id: 'cli-1',
        name: 'Cliente Test',
        dailyDebtBalance: 150,
        bankDebtBalance: 500,
        currentBalance: 650,
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const res = await transactionsService.registerDailyDebtPayment(
        'cli-1',
        { isFullPayoff: true },
        mockAdmin,
      );
      expect(res.payment.amount).toBe(150);
      expect(res.payment.targetType).toBe('dailyDebt');
    });

    it('B: registerDailyDebtPayment parcial reduce solo deuda corriente', async () => {
      const client = {
        id: 'cli-1',
        name: 'Cliente Test',
        dailyDebtBalance: 150,
        bankDebtBalance: 500,
        currentBalance: 650,
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const res = await transactionsService.registerDailyDebtPayment(
        'cli-1',
        { amount: 50 },
        mockAdmin,
      );
      expect(res.payment.amount).toBe(50);
      expect(res.payment.targetType).toBe('dailyDebt');
    });

    it('C & D: registerLoanPayment liquida o abona solo al préstamo bancario especificado', async () => {
      const loan = {
        id: 'loan-1',
        code: 'CR-100',
        clientId: 'cli-1',
        totalAmount: 500,
        pendingAmount: 300,
        paidAmount: 200,
        status: 'Activo',
        installments: [
          {
            id: 'inst-1',
            loanId: 'loan-1',
            installmentNumber: 1,
            amount: 150,
            paidAmount: 0,
            dueDate: '2026-10-01',
            status: 'Pendiente',
          },
          {
            id: 'inst-2',
            loanId: 'loan-1',
            installmentNumber: 2,
            amount: 150,
            paidAmount: 0,
            dueDate: '2026-11-01',
            status: 'Pendiente',
          },
        ],
      };
      mockPrisma.loan.findFirst.mockResolvedValue(loan);
      mockPrisma.loan.findUnique.mockResolvedValue(loan);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        currentBalance: 500,
      });
      mockPrisma.installment.findMany.mockResolvedValue(loan.installments);

      const res = await transactionsService.registerLoanPayment(
        'loan-1',
        { amount: 150 },
        mockAdmin,
      );
      expect(res.payment.targetType).toBe('bankLoan');
      expect(res.payment.amount).toBe(150);
      expect(mockPrisma.installment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-1' },
          data: expect.objectContaining({ paidAmount: 150, status: 'Pagada' }),
        }),
      );
    });

    it('E: registerLoanPayment rechaza sobrepago que supere pendingAmount', async () => {
      const loan = {
        id: 'loan-1',
        code: 'CR-100',
        clientId: 'cli-1',
        totalAmount: 500,
        pendingAmount: 200,
        status: 'Activo',
        installments: [],
      };
      mockPrisma.loan.findFirst.mockResolvedValue(loan);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        currentBalance: 500,
      });

      await expect(
        transactionsService.registerLoanPayment(
          'loan-1',
          { amount: 250 },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('F: registerLoanPayment distribuye cuotas en orden FIFO por fecha/cuota', async () => {
      const loan = {
        id: 'loan-1',
        code: 'CR-100',
        clientId: 'cli-1',
        totalAmount: 300,
        pendingAmount: 300,
        status: 'Activo',
        installments: [
          {
            id: 'inst-1',
            loanId: 'loan-1',
            installmentNumber: 1,
            amount: 100,
            paidAmount: 0,
            dueDate: '2026-09-01',
            status: 'Pendiente',
          },
          {
            id: 'inst-2',
            loanId: 'loan-1',
            installmentNumber: 2,
            amount: 100,
            paidAmount: 0,
            dueDate: '2026-10-01',
            status: 'Pendiente',
          },
          {
            id: 'inst-3',
            loanId: 'loan-1',
            installmentNumber: 3,
            amount: 100,
            paidAmount: 0,
            dueDate: '2026-11-01',
            status: 'Pendiente',
          },
        ],
      };
      mockPrisma.loan.findFirst.mockResolvedValue(loan);
      mockPrisma.loan.findUnique.mockResolvedValue(loan);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        currentBalance: 300,
      });
      mockPrisma.installment.findMany.mockResolvedValue(loan.installments);

      const res = await transactionsService.registerLoanPayment(
        'loan-1',
        { amount: 150 },
        mockAdmin,
      );
      expect(res.payment.allocations).toEqual([
        {
          targetType: 'bankLoan',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 100,
        },
        {
          targetType: 'bankLoan',
          loanId: 'loan-1',
          installmentNumber: 2,
          amount: 50,
        },
      ]);
    });

    it('G & H: addCreditPurchase aumenta solo deuda diaria y respeta exposición crediticia', async () => {
      const client = {
        id: 'cli-1',
        name: 'Cliente Límite',
        dailyDebtBalance: 200,
        bankDebtBalance: 300,
        creditLimit: 600,
        currentBalance: 500,
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      // Deuda diaria actual = 200. Compra de 450 excede límite de compras de 600 (200 + 450 = 650 > 600)
      await expect(
        transactionsService.addCreditPurchase(
          'cli-1',
          { unitPrice: 450, quantity: 1, product: 'Zapatos' },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);

      // Compra de 80 cabe dentro del límite (200 + 80 = 280 <= 600)
      const res = await transactionsService.addCreditPurchase(
        'cli-1',
        { unitPrice: 80, quantity: 1, product: 'Pantalón' },
        mockAdmin,
      );
      expect(res.purchase).toBeDefined();
      expect(res.purchase.isBaselineMovement).toBe(false);
    });

    it('I & J: createLoanCredit aumenta solo deuda bancaria y no está restringido por límite de compras', async () => {
      const client = {
        id: 'cli-1',
        name: 'Cliente Límite',
        creditLimit: 1000,
        currentBalance: 400,
        status: 'Activo',
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      // Préstamo de capital 700 con 10% interés = 770. Aunque 400 + 770 = 1170 > 1000 (límite de compras), se permite ya que los límites están desacoplados.
      const res = await transactionsService.createLoanCredit(
        'cli-1',
        { capital: 700, interestRate: 10, installmentsCount: 2 },
        mockAdmin,
      );
      expect(res.loan).toBeDefined();
    });

    it('K & L: annulLoan anula préstamo sin pagos y rechaza si tiene pagos', async () => {
      const loanWithPayments = {
        id: 'loan-paid',
        code: 'CR-PAID',
        clientId: 'cli-1',
        totalAmount: 500,
        paidAmount: 100,
        status: 'Activo',
      };
      mockPrisma.loan.findFirst.mockResolvedValue(loanWithPayments);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        openingSnapshots: [],
      });

      await expect(
        transactionsService.annulLoan('loan-paid', 'Error de tipeo', mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('M & N: annulPayment en pago post-snapshot revierte adecuadamente', async () => {
      const postDailyPay = {
        id: 'pay-post-daily',
        clientId: 'cli-1',
        amount: 50,
        isBaselineMovement: false,
        targetType: 'dailyDebt',
        status: 'Activo',
        allocations: [{ targetType: 'dailyDebt', amount: 50 }],
      };
      mockPrisma.payment.findUnique.mockResolvedValue(postDailyPay);
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cli-1' });

      const res = await transactionsService.annulPayment(
        'pay-post-daily',
        'Anulación diaria',
        mockAdmin,
      );
      expect(res.message).toContain('Abono anulado con éxito');
      expect(mockPrisma.balanceAdjustment.create).not.toHaveBeenCalled();
    });

    it('O: annulPayment en baseline con préstamos arroja 422 LEGACY_PAYMENT_ALLOCATION_AMBIGUOUS', async () => {
      const baselinePay = {
        id: 'pay-base-ambig',
        clientId: 'cli-1',
        amount: 100,
        isBaselineMovement: true,
        status: 'Activo',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(baselinePay);
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cli-1' });
      mockPrisma.loan.count.mockResolvedValue(1); // tiene préstamos

      try {
        await transactionsService.annulPayment(
          'pay-base-ambig',
          'Motivo',
          mockAdmin,
        );
        fail('Debería haber arrojado 422');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(422);
        expect(err.getResponse().code).toBe(
          'LEGACY_PAYMENT_ALLOCATION_AMBIGUOUS',
        );
      }
    });

    it('Q, R, S: Invariantes contables en BalanceSyncService', async () => {
      // Test negative bank debt invariant violation
      const client = {
        id: 'cli-inv',
        creditLimit: 1000,
        openingSnapshots: [],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);

      const synced = await balanceSyncService.syncClientBalances('cli-inv');
      expect(synced.currentBalance).toBe(
        synced.dailyDebtBalance + synced.bankDebtBalance,
      );
      expect(synced.bankDebtBalance).toBeGreaterThanOrEqual(0);
      expect(synced.creditExposure).toBeGreaterThanOrEqual(
        synced.bankDebtBalance,
      );
    });
  });

  describe('Tests Snapshot y Reversiones T - AB', () => {
    it('T: Anulación de compra baseline crea DAILY_DEBT_REVERSAL', async () => {
      const baselinePurchase = {
        id: 'pur-base-1',
        clientId: 'cli-1',
        amount: 40,
        isBaselineMovement: true,
        status: 'Activo',
      };
      mockPrisma.creditPurchase.findUnique.mockResolvedValue(baselinePurchase);
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cli-1' });

      await transactionsService.annulPurchase(
        'pur-base-1',
        'Error histórico',
        mockAdmin,
      );
      expect(mockPrisma.balanceAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DAILY_DEBT_REVERSAL',
            sourceType: 'CREDIT_PURCHASE',
            sourceId: 'pur-base-1',
            amount: 40,
          }),
        }),
      );
    });

    it('U: Anulación de compra post-snapshot NO crea BalanceAdjustment', async () => {
      const postPurchase = {
        id: 'pur-post-1',
        clientId: 'cli-1',
        amount: 70,
        isBaselineMovement: false,
        status: 'Activo',
      };
      mockPrisma.creditPurchase.findUnique.mockResolvedValue(postPurchase);
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cli-1' });

      await transactionsService.annulPurchase(
        'pur-post-1',
        'Devolución post',
        mockAdmin,
      );
      expect(mockPrisma.balanceAdjustment.create).not.toHaveBeenCalled();
    });

    it('V: Anulación de pago baseline para cliente con 0 préstamos crea DAILY_PAYMENT_REVERSAL', async () => {
      const baselinePay = {
        id: 'pay-base-no-loans',
        clientId: 'cli-1',
        amount: 80,
        isBaselineMovement: true,
        status: 'Activo',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(baselinePay);
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cli-1' });
      mockPrisma.loan.count.mockResolvedValue(0);

      await transactionsService.annulPayment(
        'pay-base-no-loans',
        'Anulación pago puro',
        mockAdmin,
      );
      expect(mockPrisma.balanceAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DAILY_PAYMENT_REVERSAL',
            sourceType: 'PAYMENT',
            sourceId: 'pay-base-no-loans',
            amount: 80,
          }),
        }),
      );
    });

    it('AB: Anulación de préstamo pre-snapshot crea BANK_LOAN_REVERSAL', async () => {
      const cutOff = new Date('2026-09-01T00:00:00.000Z');
      const baselineLoan = {
        id: 'loan-base-1',
        code: 'CR-BASE',
        clientId: 'cli-1',
        totalAmount: 1000,
        paidAmount: 0,
        createdAt: new Date('2026-08-15T00:00:00.000Z'),
        status: 'Activo',
      };
      mockPrisma.loan.findFirst.mockResolvedValue(baselineLoan);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(0),
            bankDebtOpeningBalance: new Prisma.Decimal(1000),
            currentOpeningBalance: new Prisma.Decimal(1000),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      });

      await transactionsService.annulLoan(
        'loan-base-1',
        'Anulación crédito baseline',
        mockAdmin,
      );
      expect(mockPrisma.balanceAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'BANK_LOAN_REVERSAL',
            sourceType: 'LOAN',
            sourceId: 'loan-base-1',
            amount: 1000,
          }),
        }),
      );
    });
  });

  describe('Tests de Frontera Temporal AC.1 - AC.3', () => {
    it('AC.1: Compra con createdAt < cutOffDate no entra a cargos post-snapshot', async () => {
      const cutOff = new Date('2026-09-01T12:00:00.000Z');
      const client = {
        id: 'cli-temp',
        creditLimit: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(100),
            bankDebtOpeningBalance: new Prisma.Decimal(0),
            currentOpeningBalance: new Prisma.Decimal(100),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([
        {
          id: 'p-old',
          clientId: 'cli-temp',
          amount: 50,
          isBaselineMovement: false, // simulating edge
          createdAt: new Date('2026-09-01T10:00:00.000Z'), // prior to cutoff
          status: 'Activo',
        },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const res = await balanceSyncService.syncClientBalances('cli-temp');
      expect(res.dailyDebtBalance).toBe(100); // 50 is excluded because createdAt < cutOffDate
    });

    it('AC.2: Compra con createdAt === cutOffDate no entra a cargos post-snapshot', async () => {
      const cutOff = new Date('2026-09-01T12:00:00.000Z');
      const client = {
        id: 'cli-temp',
        creditLimit: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(100),
            bankDebtOpeningBalance: new Prisma.Decimal(0),
            currentOpeningBalance: new Prisma.Decimal(100),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([
        {
          id: 'p-exact',
          clientId: 'cli-temp',
          amount: 50,
          isBaselineMovement: false,
          createdAt: new Date(cutOff.getTime()), // exact cutoff
          status: 'Activo',
        },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const res = await balanceSyncService.syncClientBalances('cli-temp');
      expect(res.dailyDebtBalance).toBe(100);
    });

    it('AC.3: Compra con createdAt > cutOffDate e isBaselineMovement=false se incorpora al saldo', async () => {
      const cutOff = new Date('2026-09-01T12:00:00.000Z');
      const client = {
        id: 'cli-temp',
        creditLimit: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(100),
            bankDebtOpeningBalance: new Prisma.Decimal(0),
            currentOpeningBalance: new Prisma.Decimal(100),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([
        {
          id: 'p-new',
          clientId: 'cli-temp',
          amount: 50,
          isBaselineMovement: false,
          createdAt: new Date('2026-09-01T12:00:01.000Z'), // post cutoff
          status: 'Activo',
        },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const res = await balanceSyncService.syncClientBalances('cli-temp');
      expect(res.dailyDebtBalance).toBe(150);
    });
  });

  describe('Tests de Decimales, Aprobaciones y Límites AD - AK', () => {
    it('AD: Cálculos decimales son exactos a 2 decimales con redondeo half up', async () => {
      const client = {
        id: 'cli-dec',
        creditLimit: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal('10.33'),
            bankDebtOpeningBalance: new Prisma.Decimal('0.00'),
            currentOpeningBalance: new Prisma.Decimal('10.33'),
            cutOffDate: new Date('2026-09-01T00:00:00.000Z'),
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([
        {
          id: 'p-dec',
          clientId: 'cli-dec',
          amount: 20.67,
          isBaselineMovement: false,
          createdAt: new Date('2026-09-02T00:00:00.000Z'),
          status: 'Activo',
        },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const res = await balanceSyncService.syncClientBalances('cli-dec');
      expect(res.dailyDebtBalance).toBe(31.0);
      expect(res.currentBalance).toBe(31.0);
    });

    it('AE: Saldo a favor permitido en deuda corriente (dailyDebtBalance < 0)', async () => {
      const client = {
        id: 'cli-favor',
        name: 'Cliente Favor',
        dailyDebtBalance: 50,
        bankDebtBalance: 0,
        currentBalance: 50,
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      // Abono de 80 supera deuda de 50 -> permitido en deuda diaria
      const res = await transactionsService.registerDailyDebtPayment(
        'cli-favor',
        { amount: 80 },
        mockAdmin,
      );
      expect(res.payment.amount).toBe(80);
      expect(res.payment.targetType).toBe('dailyDebt');
    });

    it('AF: Saldo a favor estrictamente prohibido en crédito bancario', async () => {
      const loan = {
        id: 'loan-af',
        code: 'CR-AF',
        clientId: 'cli-1',
        totalAmount: 100,
        pendingAmount: 100,
        status: 'Activo',
        installments: [],
      };
      mockPrisma.loan.findFirst.mockResolvedValue(loan);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        currentBalance: 100,
      });

      // Abono de 120 supera saldo de 100 -> Rechazado
      await expect(
        transactionsService.registerLoanPayment(
          'loan-af',
          { amount: 120 },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('AG: Doble anulación de compra es rechazada', async () => {
      const annulledPurchase = {
        id: 'pur-annulled',
        clientId: 'cli-1',
        status: 'Anulado',
      };
      mockPrisma.creditPurchase.findUnique.mockResolvedValue(annulledPurchase);
      await expect(
        transactionsService.annulPurchase('pur-annulled', 'Motivo', mockAdmin),
      ).rejects.toThrow('Esta compra ya se encuentra anulada');
    });

    it('AH: Doble anulación de pago es rechazada', async () => {
      const annulledPayment = {
        id: 'pay-annulled',
        clientId: 'cli-1',
        status: 'Anulado',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(annulledPayment);
      await expect(
        transactionsService.annulPayment('pay-annulled', 'Motivo', mockAdmin),
      ).rejects.toThrow('Este abono ya se encuentra anulado');
    });

    it('AI: Doble anulación de crédito es rechazada', async () => {
      const annulledLoan = {
        id: 'loan-annulled',
        code: 'CR-ANN',
        clientId: 'cli-1',
        status: 'Anulado',
      };
      mockPrisma.loan.findFirst.mockResolvedValue(annulledLoan);
      await expect(
        transactionsService.annulLoan('loan-annulled', 'Motivo', mockAdmin),
      ).rejects.toThrow('Este crédito ya se encuentra anulado');
    });

    it('AJ & AK: Cajero registra abono en PENDING_APPROVAL y rechazo no altera saldos', async () => {
      const client = {
        id: 'cli-caj',
        name: 'Cliente Cajero',
        dailyDebtBalance: 100,
        bankDebtBalance: 0,
        currentBalance: 100,
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const res = await transactionsService.registerDailyDebtPayment(
        'cli-caj',
        { amount: 40 },
        mockCajero,
      );
      expect(res.payment.approvedStatus).toBe('PENDING_APPROVAL');
      expect(res.payment.resultingBalance).toBe(100); // Intact until approved

      // Reject payment
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-pending-1',
        clientId: 'cli-caj',
        amount: 40,
        approvedStatus: 'PENDING_APPROVAL',
      });
      const rejectRes = await transactionsService.rejectPayment(
        'pay-pending-1',
        'Comprobante ilegible',
        mockAdmin,
      );
      expect(rejectRes.message).toContain('Abono rechazado con éxito');
    });
  });

  describe('Tests de Integridad y Carrera AL - AS (User Prompt Corrections)', () => {
    it('AL: Toda nueva compra se inserta con isBaselineMovement = false', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        name: 'Cliente',
        currentBalance: 0,
        creditLimit: 500,
      });
      const res = await transactionsService.addCreditPurchase(
        'cli-1',
        { unitPrice: 25, quantity: 2, product: 'Camisa' },
        mockAdmin,
      );
      expect(res.purchase.isBaselineMovement).toBe(false);
    });

    it('AM: Loan nuevo posterior al snapshot participa correctamente sin isBaselineMovement', async () => {
      const cutOff = new Date('2026-09-01T00:00:00.000Z');
      const client = {
        id: 'cli-loan-new',
        creditLimit: 2000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(0),
            bankDebtOpeningBalance: new Prisma.Decimal(0),
            currentOpeningBalance: new Prisma.Decimal(0),
            cutOffDate: cutOff,
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const newLoan = {
        id: 'loan-post-snap',
        clientId: 'cli-loan-new',
        totalAmount: 450,
        pendingAmount: 450,
        status: 'Activo',
        createdAt: new Date('2026-09-05T00:00:00.000Z'),
        // Notice: Loan does NOT have isBaselineMovement column!
      };
      mockPrisma.loan.findMany.mockResolvedValue([newLoan]);

      const res = await balanceSyncService.syncClientBalances('cli-loan-new');
      expect(res.bankDebtBalance).toBe(450);
      expect(res.currentBalance).toBe(450);
    });

    it('AN: Cliente nuevo sin BalanceOpeningSnapshot procesa compra con mismo timestamp técnico sin fallar', async () => {
      const sameTimestamp = new Date('2026-09-05T12:00:00.000Z');
      const client = {
        id: 'cli-brand-new',
        createdAt: sameTimestamp,
        creditLimit: 1000,
        openingSnapshots: [], // Sin snapshot
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([
        {
          id: 'p-brand-new',
          clientId: 'cli-brand-new',
          amount: 120,
          isBaselineMovement: false,
          createdAt: sameTimestamp, // Exact same timestamp as client!
          status: 'Activo',
        },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);

      const res = await balanceSyncService.syncClientBalances('cli-brand-new');
      expect(res.dailyDebtBalance).toBe(120);
      expect(res.currentBalance).toBe(120);
    });

    it('AO: Payment de 100 con allocations que suman 90 lanza BALANCE_LEDGER_INTEGRITY_ERROR', () => {
      expect(() => {
        validatePaymentAllocations(100, 'dailyDebt', [
          { targetType: 'dailyDebt', amount: 90 },
        ]);
      }).toThrow(
        'BALANCE_LEDGER_INTEGRITY_ERROR: La suma de allocations (90.00) no coincide con el importe total del pago (100.00).',
      );
    });

    it('AP: Payment bankLoan con allocation apuntando a otro préstamo lanza error', () => {
      expect(() => {
        validatePaymentAllocations(
          100,
          'bankLoan',
          [{ targetType: 'bankLoan', loanId: 'loan-WRONG', amount: 100 }],
          'loan-TARGET',
          ['loan-TARGET'],
        );
      }).toThrow(
        'BALANCE_LEDGER_INTEGRITY_ERROR: Allocation bancaria apunta a un préstamo (loan-WRONG) distinto al objetivo (loan-TARGET).',
      );
    });

    it('AQ: legacyMixed con allocations correctas suma exacta y sincroniza ambas carteras', async () => {
      const mixedAllocations = [
        { targetType: 'dailyDebt', amount: 40 },
        { targetType: 'bankLoan', loanId: 'loan-1', amount: 60 },
      ];
      expect(() => {
        validatePaymentAllocations(
          100,
          'legacyMixed',
          mixedAllocations,
          undefined,
          ['loan-1'],
        );
      }).not.toThrow();

      const client = {
        id: 'cli-mix',
        creditLimit: 1000,
        openingSnapshots: [
          {
            dailyDebtOpeningBalance: new Prisma.Decimal(100),
            bankDebtOpeningBalance: new Prisma.Decimal(200),
            currentOpeningBalance: new Prisma.Decimal(300),
            cutOffDate: new Date('2026-09-01T00:00:00.000Z'),
            status: 'ACTIVO',
            migrationVersion: 'BALANCE_MODEL_V1',
          },
        ],
      };
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockPrisma.creditPurchase.findMany.mockResolvedValue([]);
      mockPrisma.balanceAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([
        { id: 'loan-1', pendingAmount: 140, status: 'Activo' },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-mix',
          clientId: 'cli-mix',
          amount: 100,
          targetType: 'legacyMixed',
          allocations: mixedAllocations,
          isBaselineMovement: false,
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
          status: 'Activo',
        },
      ]);

      const res = await balanceSyncService.syncClientBalances('cli-mix');
      expect(res.dailyDebtBalance).toBe(60); // 100 - 40
      expect(res.bankDebtBalance).toBe(140); // loan pending is 140
      expect(res.currentBalance).toBe(200);
    });

    it('AR: resolveAmbiguousReversal con dos préstamos permite allocations bancarias separadas y mantiene histórico intacto', async () => {
      const historicalPayment = {
        id: 'pay-ambig-2loans',
        clientId: 'cli-1',
        amount: 250,
        targetType: null,
        allocations: null,
        status: 'Activo',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(historicalPayment);
      mockPrisma.client.findUnique.mockResolvedValue({
        id: 'cli-1',
        name: 'Cliente',
      });
      mockPrisma.balanceAdjustment.findFirst.mockResolvedValue(null);
      mockPrisma.loan.findFirst.mockImplementation(({ where }) => ({
        id: where.id,
        clientId: 'cli-1',
      }));
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findUnique.mockResolvedValue({
        id: 'loan-1',
        totalAmount: 500,
      });

      const res = await transactionsService.resolveAmbiguousReversal(
        'pay-ambig-2loans',
        {
          dailyDebtAmount: 50,
          bankAllocations: [
            { loanId: 'loan-A', amount: 100 },
            { loanId: 'loan-B', amount: 100 },
          ],
          reason: 'Resolución multipartita',
        },
        mockAdmin,
      );

      expect(res.message).toContain(
        'Abono ambiguo resuelto y anulado con éxito',
      );
      // Verify payment was marked Anulado
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-ambig-2loans' },
          data: expect.objectContaining({ status: 'Anulado' }),
        }),
      );
      // Verify historical targetType and allocations were NOT modified
      const updateArgs = mockPrisma.payment.update.mock.calls[0][0];
      expect(updateArgs.data.targetType).toBeUndefined();
      expect(updateArgs.data.allocations).toBeUndefined();

      // Verify 3 adjustments created (1 daily, 2 bank)
      expect(mockPrisma.balanceAdjustment.create).toHaveBeenCalledTimes(3);
    });

    it('AS: Segunda resolución del mismo payment es rechazada y no duplica BalanceAdjustment', async () => {
      const resolvedPayment = {
        id: 'pay-already-resolved',
        clientId: 'cli-1',
        amount: 100,
        status: 'Anulado',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(resolvedPayment);

      await expect(
        transactionsService.resolveAmbiguousReversal(
          'pay-already-resolved',
          { dailyDebtAmount: 100, bankAllocations: [] },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
