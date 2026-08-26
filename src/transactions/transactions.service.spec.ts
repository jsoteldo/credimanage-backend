import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransactionsService - Créditos con Intereses', () => {
  let service: TransactionsService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser = { id: 'usr-1', name: 'Admin Test', role: 'Administrador' };

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
      update: jest.fn((args) => {
        // Return client with updated balance if increment or decrement is requested
        const increment = args?.data?.currentBalance?.increment || 0;
        const decrement = args?.data?.currentBalance?.decrement || 0;
        return {
          id: args?.where?.id || 'cli-1',
          name: 'Juan Perez',
          clientNumber: 'CLI-1001',
          currentBalance: 1100 + increment - decrement,
          paymentPeriod: 'Mensual',
        };
      }),
    },
    loan: {
      create: jest.fn(({ data }) => ({
        id: 'loan-1',
        ...data,
        installments: data.installments?.create || [],
      })),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(({ where, data }) => ({
        id: where.id,
        ...data,
      })),
    },
    installment: {
      update: jest.fn(({ where, data }) => ({
        id: where.id,
        ...data,
      })),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    creditPurchase: {
      create: jest.fn(({ data }) => ({
        id: 'pur-1',
        ...data,
      })),
      updateMany: jest.fn(),
    },
    payment: {
      create: jest.fn(({ data }) => ({
        id: 'pay-1',
        ...data,
      })),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockAudit = {
    logAudit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('Cálculos e Interés Simple', () => {
    it('debe calcular correctamente el interés simple, total y cuotas ajustando centavos en la última cuota', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        status: 'Activo',
        creditLimit: 2000,
        currentBalance: 0,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.loan.create.mockImplementation(({ data }) => ({
        id: 'loan-1',
        ...data,
        installments: data.installments.create,
      }));

      // Caso 1: 1000 capital, 10% interes, 5 cuotas -> total 1100, cuota 220
      const result = await service.createLoanCredit(
        'cli-1',
        {
          capital: 1000,
          interestRate: 10,
          installmentsCount: 5,
          frequency: 'Mensual',
          firstDueDate: '2026-09-18',
        },
        mockUser
      );

      expect(result.loan.capital).toBe(1000);
      expect(result.loan.interestAmount).toBe(100);
      expect(result.loan.totalAmount).toBe(1100);
      expect(result.loan.installmentAmount).toBe(220);
      expect(result.loan.installments).toHaveLength(5);
      
      // Cada cuota debe ser 220
      result.loan.installments.forEach((inst: any) => {
        expect(inst.amount).toBe(220);
      });
    });

    it('debe ajustar centavos por redondeo en la última cuota', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        status: 'Activo',
        creditLimit: 2000,
        currentBalance: 0,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.loan.create.mockImplementation(({ data }) => ({
        id: 'loan-1',
        ...data,
        installments: data.installments.create,
      }));

      // Caso: 1000 capital, 10% interes, 3 cuotas. Total 1100.
      // 1100 / 3 = 366.6666... -> cuota base 366.67.
      // Cuotas: 366.67, 366.67, y la última debe ser ajustada a: 1100 - (366.67 * 2) = 366.66
      const result = await service.createLoanCredit(
        'cli-1',
        {
          capital: 1000,
          interestRate: 10,
          installmentsCount: 3,
          frequency: 'Mensual',
          firstDueDate: '2026-09-18',
        },
        mockUser
      );

      const insts = result.loan.installments;
      expect(insts[0].amount).toBe(366.66);
      expect(insts[1].amount).toBe(366.66);
      expect(insts[2].amount).toBe(366.68); // Última cuota ajustada para sumar 1100
      const sum = insts.reduce((s: number, i: any) => s + i.amount, 0);
      expect(sum).toBe(1100);
    });
  });

  describe('Límite de Crédito', () => {
    it('debe permitir crear crédito si no supera el límite de crédito', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        status: 'Activo',
        creditLimit: 1500,
        currentBalance: 500,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.loan.create.mockImplementation(({ data }) => ({
        id: 'loan-1',
        ...data,
        installments: data.installments.create,
      }));

      // 800 total crédito + 500 balance = 1300 <= 1500 limit. Permitido.
      const result = await service.createLoanCredit(
        'cli-1',
        {
          capital: 800,
          interestRate: 0,
          installmentsCount: 1,
          frequency: 'Mensual',
          firstDueDate: '2026-09-18',
        },
        mockUser
      );

      expect(result).toBeDefined();
    });

    it('debe rechazar la creación del crédito si supera el límite configurado', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        status: 'Activo',
        creditLimit: 1500,
        currentBalance: 1000,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      // 800 total crédito + 1000 balance = 1800 > 1500 limit. Rechazado.
      await expect(
        service.createLoanCredit(
          'cli-1',
          {
            capital: 800,
            interestRate: 0,
            installmentsCount: 1,
            frequency: 'Mensual',
            firstDueDate: '2026-09-18',
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Distribución de Abonos', () => {
    it('debe distribuir el abono a la cuota pendiente más antigua y actualizar su estado a Parcial o Pagada', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        currentBalance: 1100,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      const mockLoans = [
        {
          id: 'loan-1',
          totalAmount: 1100,
          paidAmount: 0,
          installments: [
            { id: 'inst-1', installmentNumber: 1, dueDate: '2026-09-18', amount: 220, paidAmount: 0, status: 'Pendiente' },
            { id: 'inst-2', installmentNumber: 2, dueDate: '2026-10-18', amount: 220, paidAmount: 0, status: 'Pendiente' },
            { id: 'inst-3', installmentNumber: 3, dueDate: '2026-11-18', amount: 220, paidAmount: 0, status: 'Pendiente' },
          ],
        },
      ];

      mockPrisma.loan.findMany.mockResolvedValue(mockLoans);
      mockPrisma.installment.findMany.mockResolvedValue(mockLoans[0].installments);

      // Caso: Abono de S/ 500.
      // Debe pagar completa la cuota 1 (220) e inst-1 status 'Pagada'.
      // Debe pagar completa la cuota 2 (220) e inst-2 status 'Pagada'.
      // Debe pagar parcialmente la cuota 3 (60 pagados, 160 pendientes) e inst-3 status 'Parcial'.
      const result = await service.registerPayment(
        'cli-1',
        {
          amount: 500,
          paymentMethod: 'Efectivo',
        },
        mockUser
      );

      expect(result).toBeDefined();
      expect(mockPrisma.installment.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: expect.objectContaining({ paidAmount: 220, status: 'Pagada' }),
      });
      expect(mockPrisma.installment.update).toHaveBeenCalledWith({
        where: { id: 'inst-2' },
        data: expect.objectContaining({ paidAmount: 220, status: 'Pagada' }),
      });
      expect(mockPrisma.installment.update).toHaveBeenCalledWith({
        where: { id: 'inst-3' },
        data: expect.objectContaining({ paidAmount: 60, status: 'Parcial' }),
      });
    });

    it('debe rechazar abonos que causen un sobrepago accidental', async () => {
      const mockClient = {
        id: 'cli-1',
        name: 'Juan Perez',
        currentBalance: 300,
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      // Abono de 500 > balance de 300 -> Rechazar
      await expect(
        service.registerPayment(
          'cli-1',
          {
            amount: 500,
            paymentMethod: 'Efectivo',
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});
