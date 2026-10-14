import { Test, TestingModule } from '@nestjs/testing';
import { CashService, DEFAULT_RECEIPT_CONFIG } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CashRegisterStatus,
  CashSessionStatus,
  CashMovementType,
  SalePaymentMethod,
  Prisma,
} from '@prisma/client';

describe('ETAPA 3: Módulo de Caja, Turnos, Movimientos y Boleta Simple (Pruebas A a Z y AA a AE)', () => {
  let cashService: CashService;

  // In-memory mock database
  let registersDb: any[] = [];
  let sessionsDb: any[] = [];
  let movementsDb: any[] = [];
  let receiptsDb: any[] = [];
  let sequenceCounter = 0;
  let settingsDb: Map<string, string> = new Map();

  const mockUserAdmin = {
    id: 'usr-admin-1',
    name: 'Carlos Admin',
    email: 'admin@credimanage.com',
    role: 'Administrador',
  };

  const mockUserCajero = {
    id: 'usr-cajero-1',
    name: 'Pedro Cajero',
    email: 'cajero@credimanage.com',
    role: 'Cajero',
  };

  const mockStore = {
    id: 'store-centro',
    name: 'Tienda Centro',
    code: 'TC-01',
    active: true,
    businessId: 'default',
  };

  let mockPrisma: any;
  let mockAuditService: any;
  let mockSettingsService: any;

  beforeEach(async () => {
    registersDb = [
      {
        id: 'reg-01',
        businessId: 'default',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja 01',
        status: CashRegisterStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'reg-inactive',
        businessId: 'default',
        storeId: 'store-centro',
        code: 'CAJA-INACTIVA',
        name: 'Caja Inactiva',
        status: CashRegisterStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    sessionsDb = [];
    movementsDb = [];
    receiptsDb = [];
    sequenceCounter = 0;
    settingsDb = new Map();

    mockAuditService = {
      logAudit: jest.fn(async () => {}),
    };

    mockSettingsService = {
      getSetting: jest.fn(async (key: string) => settingsDb.get(key) || null),
      setSetting: jest.fn(async (key: string, value: string) => {
        settingsDb.set(key, value);
        return { key, value };
      }),
    };

    mockPrisma = {
      location: {
        findFirst: jest.fn(async ({ where }) => {
          if (where.id === 'store-centro' && where.active !== false) return mockStore;
          if (where.active !== false) return { id: where.id, name: `Tienda ${where.id}`, code: 'LOC', active: true };
          return null;
        }),
      },
      cashRegister: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id) return registersDb.find((r) => r.id === where.id) || null;
          if (where.storeId_code) {
            return (
              registersDb.find(
                (r) =>
                  r.storeId === where.storeId_code.storeId &&
                  r.code === where.storeId_code.code,
              ) || null
            );
          }
          return null;
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            registersDb.find(
              (r) =>
                (!where.id || r.id === where.id) &&
                (!where.storeId || r.storeId === where.storeId) &&
                (!where.code || r.code === where.code),
            ) || null
          );
        }),
        findMany: jest.fn(async () => registersDb),
        create: jest.fn(async ({ data }) => {
          const reg = { id: `reg-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          registersDb.push(reg);
          return { ...reg, store: mockStore };
        }),
        update: jest.fn(async ({ where, data }) => {
          const reg = registersDb.find((r) => r.id === where.id);
          if (reg) Object.assign(reg, data);
          return { ...reg, store: mockStore };
        }),
      },
      cashSession: {
        findUnique: jest.fn(async ({ where }) => {
          const s = sessionsDb.find((ses) => ses.id === where.id);
          if (!s) return null;
          return {
            ...s,
            cashRegister: registersDb.find((r) => r.id === s.cashRegisterId),
            store: mockStore,
            movements: movementsDb.filter((m) => m.cashSessionId === s.id),
          };
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            sessionsDb.find((ses) => {
              if (where.id && ses.id !== where.id) return false;
              if (where.cashRegisterId && ses.cashRegisterId !== where.cashRegisterId) return false;
              if (where.storeId && ses.storeId !== where.storeId) return false;
              if (where.status && ses.status !== where.status) return false;
              if (where.openedByUserId && ses.openedByUserId !== where.openedByUserId) return false;
              return true;
            }) || null
          );
        }),
        findMany: jest.fn(async () => sessionsDb),
        count: jest.fn(async () => sessionsDb.length),
        create: jest.fn(async ({ data }) => {
          const ses = {
            id: `ses-${Date.now()}-${Math.random()}`,
            ...data,
            status: CashSessionStatus.OPEN,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          sessionsDb.push(ses);
          return ses;
        }),
        update: jest.fn(async ({ where, data }) => {
          const ses = sessionsDb.find((s) => s.id === where.id);
          if (ses) Object.assign(ses, data);
          return {
            ...ses,
            cashRegister: registersDb.find((r) => r.id === ses.cashRegisterId),
            store: mockStore,
          };
        }),
      },
      cashMovement: {
        create: jest.fn(async ({ data }) => {
          const mov = {
            id: `mov-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          movementsDb.push(mov);
          return mov;
        }),
        findMany: jest.fn(async () => movementsDb),
        count: jest.fn(async () => movementsDb.length),
      },
      salePayment: {
        findMany: jest.fn(async () => []),
      },
      sale: {
        count: jest.fn(async () => 0),
        findUnique: jest.fn(async () => null),
      },
      receipt: {
        findUnique: jest.fn(async ({ where }) => {
          return receiptsDb.find((r) => r.saleId === where.saleId || r.id === where.id) || null;
        }),
        create: jest.fn(async ({ data }) => {
          const rec = { id: `rec-${Date.now()}`, reprintedCount: 0, ...data, createdAt: new Date() };
          receiptsDb.push(rec);
          return rec;
        }),
        update: jest.fn(async ({ where, data }) => {
          const rec = receiptsDb.find((r) => r.id === where.id);
          if (rec) {
            if (data.reprintedCount?.increment) rec.reprintedCount += data.reprintedCount.increment;
            if (data.lastReprintedAt) rec.lastReprintedAt = data.lastReprintedAt;
          }
          return rec;
        }),
      },
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
      $queryRaw: jest.fn(async () => {
        sequenceCounter++;
        return [{ currentSequence: sequenceCounter }];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    cashService = module.get<CashService>(CashService);
  });

  // =========================================================================
  // 64. TESTS BACKEND — APERTURA
  // =========================================================================
  describe('64. Apertura de Caja', () => {
    it('A. Abrir caja con S/ 200: crea CashSession OPEN y CashMovement OPENING de +200', async () => {
      const session = await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 200,
          notes: 'Apertura turno mañana',
        },
        mockUserCajero,
      );

      expect(session).toBeDefined();
      expect(session.status).toBe(CashSessionStatus.OPEN);
      expect(Number(session.openingCashAmount)).toBe(200);

      // Verify CashMovement OPENING
      const openingMov = movementsDb.find((m) => m.type === CashMovementType.OPENING);
      expect(openingMov).toBeDefined();
      expect(Number(openingMov.amount)).toBe(200);
      expect(openingMov.paymentMethod).toBe(SalePaymentMethod.CASH);
      expect(openingMov.cashSessionId).toBe(session.id);
    });

    it('B. Segunda apertura sobre la misma caja debe ser rechazada (ConflictException)', async () => {
      await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 200,
        },
        mockUserCajero,
      );

      await expect(
        cashService.openSession(
          {
            cashRegisterId: 'reg-01',
            storeId: 'store-centro',
            openingCashAmount: 150,
          },
          mockUserAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('C. Intentar abrir una caja inactiva debe ser rechazado (BadRequestException)', async () => {
      await expect(
        cashService.openSession(
          {
            cashRegisterId: 'reg-inactive',
            storeId: 'store-centro',
            openingCashAmount: 100,
          },
          mockUserCajero,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 67. TESTS BACKEND — MOVIMIENTOS MANUALES
  // =========================================================================
  describe('67. Movimientos Manuales (CASH_IN y CASH_OUT)', () => {
    let activeSession: any;

    beforeEach(async () => {
      activeSession = await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 200,
        },
        mockUserCajero,
      );
    });

    it('M. CASH_IN manual crea CashMovement con monto positivo y método CASH', async () => {
      const res = await cashService.addManualMovement(
        activeSession.id,
        {
          type: 'CASH_IN',
          amount: 50,
          reason: 'Reposición de sencillo',
        },
        mockUserAdmin,
      );

      expect(res.movement).toBeDefined();
      expect(res.movement.type).toBe(CashMovementType.CASH_IN);
      expect(Number(res.movement.amount)).toBe(50);
      expect(res.movement.paymentMethod).toBe(SalePaymentMethod.CASH);
      expect(res.summary.expectedCashAmount).toBe(250);
    });

    it('N. CASH_OUT manual crea CashMovement con monto negativo y método CASH', async () => {
      const authorizedCajero = {
        ...mockUserCajero,
        permissions: ['cash.cash_out'],
      };
      const res = await cashService.addManualMovement(
        activeSession.id,
        {
          type: 'CASH_OUT',
          amount: 40,
          reason: 'Pago de taxi delivery',
        },
        authorizedCajero,
      );

      expect(res.movement).toBeDefined();
      expect(res.movement.type).toBe(CashMovementType.CASH_OUT);
      expect(Number(res.movement.amount)).toBe(-40);
      expect(res.summary.expectedCashAmount).toBe(160);
    });

    it('O. Retiro que deje efectivo negativo genera advertencia sin bloquear la operación', async () => {
      const res = await cashService.addManualMovement(
        activeSession.id,
        {
          type: 'CASH_OUT',
          amount: 300,
          reason: 'Retiro urgente superior al fondo',
        },
        mockUserAdmin,
      );

      expect(res.warning).toContain('dejará la caja con un efectivo esperado negativo');
      expect(res.summary.expectedCashAmount).toBe(-100);
    });

    it('P. Sesión cerrada no debe aceptar movimientos manuales', async () => {
      await cashService.closeSession(
        activeSession.id,
        { countedCashAmount: 200 },
        mockUserAdmin,
      );

      await expect(
        cashService.addManualMovement(
          activeSession.id,
          {
            type: 'CASH_IN',
            amount: 20,
            reason: 'Intento en sesión cerrada',
          },
          mockUserAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    describe('Control de Permisos de Movimientos Manuales (CASH_IN / CASH_OUT): Pruebas A a I', () => {
      it('A. Administrador autorizado registra CASH_IN exitosamente', async () => {
        const res = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_IN', amount: 100, reason: 'Fondo adicional' },
          mockUserAdmin,
        );
        expect(res.movement).toBeDefined();
        expect(res.movement.type).toBe(CashMovementType.CASH_IN);
      });

      it('B. Administrador autorizado registra CASH_OUT exitosamente', async () => {
        const res = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_OUT', amount: 50, reason: 'Pago de servicios' },
          mockUserAdmin,
        );
        expect(res.movement).toBeDefined();
        expect(res.movement.type).toBe(CashMovementType.CASH_OUT);
      });

      it('C. Cajero sin CAJA_RETIRAR_EFECTIVO / cash.cash_out: retiro lanza 403 ForbiddenException', async () => {
        const cajeroSinPermiso = { ...mockUserCajero, permissions: [] };
        await expect(
          cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 30, reason: 'Retiro no autorizado' },
            cajeroSinPermiso,
          ),
        ).rejects.toThrow(ForbiddenException);

        try {
          await cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 30, reason: 'Retiro no autorizado' },
            cajeroSinPermiso,
          );
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
          expect(err.message).toBe('No tienes permiso para registrar retiros de caja.');
        }
      });

      it('D. Cajero con CAJA_RETIRAR_EFECTIVO / cash.cash_out: retiro permitido', async () => {
        const cajeroConPermiso = { ...mockUserCajero, permissions: ['cash.cash_out'] };
        const res = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_OUT', amount: 20, reason: 'Compra menor de suministros' },
          cajeroConPermiso,
        );
        expect(res.movement).toBeDefined();
        expect(res.movement.type).toBe(CashMovementType.CASH_OUT);

        // Also test with legacy/alias code CAJA_RETIRAR_EFECTIVO
        const cajeroConAlias = { ...mockUserCajero, permissions: ['CAJA_RETIRAR_EFECTIVO'] };
        const resAlias = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_OUT', amount: 10, reason: 'Retiro autorizado con alias' },
          cajeroConAlias,
        );
        expect(resAlias.movement).toBeDefined();
      });

      it('E. Cajero sin CAJA_INGRESAR_EFECTIVO / cash.cash_in: ingreso lanza 403 ForbiddenException', async () => {
        const cajeroSinPermiso = { ...mockUserCajero, permissions: [] };
        await expect(
          cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_IN', amount: 50, reason: 'Ingreso no autorizado' },
            cajeroSinPermiso,
          ),
        ).rejects.toThrow(ForbiddenException);

        try {
          await cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_IN', amount: 50, reason: 'Ingreso no autorizado' },
            cajeroSinPermiso,
          );
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
          expect(err.message).toBe('No tienes permiso para registrar ingresos manuales de caja.');
        }
      });

      it('F. Cajero con CAJA_INGRESAR_EFECTIVO / cash.cash_in: ingreso permitido', async () => {
        const cajeroConPermiso = { ...mockUserCajero, permissions: ['cash.cash_in'] };
        const res = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_IN', amount: 80, reason: 'Ingreso de sencillo autorizado' },
          cajeroConPermiso,
        );
        expect(res.movement).toBeDefined();
        expect(res.movement.type).toBe(CashMovementType.CASH_IN);

        // Also test with legacy/alias code CAJA_INGRESAR_EFECTIVO
        const cajeroConAlias = { ...mockUserCajero, permissions: ['CAJA_INGRESAR_EFECTIVO'] };
        const resAlias = await cashService.addManualMovement(
          activeSession.id,
          { type: 'CASH_IN', amount: 40, reason: 'Ingreso con alias' },
          cajeroConAlias,
        );
        expect(resAlias.movement).toBeDefined();
      });

      it('G. Usuario no autenticado (sin user o sin id): lanza 401 UnauthorizedException', async () => {
        await expect(
          cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 50, reason: 'Sin auth' },
            null,
          ),
        ).rejects.toThrow(UnauthorizedException);

        await expect(
          cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_IN', amount: 50, reason: 'Sin id' },
            { name: 'Anon' },
          ),
        ).rejects.toThrow(UnauthorizedException);

        try {
          await cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 50, reason: 'Sin auth' },
            null,
          );
        } catch (err: any) {
          expect(err.getStatus()).toBe(401);
          expect(err.message).toContain('No autenticado');
        }
      });

      it('H. Usuario autenticado sin permiso: lanza 403 ForbiddenException (distinto de 401)', async () => {
        const cajeroSinPermiso = { id: 'usr-unauthorized', name: 'Cajero Sin Permiso', role: 'Cajero', permissions: [] };
        try {
          await cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 15, reason: 'Test 403' },
            cajeroSinPermiso,
          );
          throw new Error('Should not reach here');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ForbiddenException);
          expect(err.getStatus()).toBe(403);
          expect(err.getStatus()).not.toBe(401);
        }
      });

      it('I. No se crea CashMovement en base de datos si falla la autorización', async () => {
        const cajeroSinPermiso = { id: 'usr-unauthorized-2', name: 'Sin Permiso', role: 'Cajero', permissions: [] };
        const countBefore = movementsDb.length;

        await expect(
          cashService.addManualMovement(
            activeSession.id,
            { type: 'CASH_OUT', amount: 99, reason: 'Retiro bloqueado' },
            cajeroSinPermiso,
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(movementsDb.length).toBe(countBefore);
      });
    });
  });

  // =========================================================================
  // 68. TESTS BACKEND — ARQUEO Y CIERRE
  // =========================================================================
  describe('68. Arqueo y Cierre de Turno', () => {
    let session: any;

    beforeEach(async () => {
      session = await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 200,
        },
        mockUserCajero,
      );

      // Add a CASH SALE (+50)
      movementsDb.push({
        id: 'mov-sale-cash',
        businessId: 'default',
        cashSessionId: session.id,
        storeId: 'store-centro',
        cashRegisterId: 'reg-01',
        type: CashMovementType.SALE,
        paymentMethod: SalePaymentMethod.CASH,
        amount: new Prisma.Decimal(50),
      });

      // Add a YAPE SALE (+30) - Does not affect physical cash
      movementsDb.push({
        id: 'mov-sale-yape',
        businessId: 'default',
        cashSessionId: session.id,
        storeId: 'store-centro',
        cashRegisterId: 'reg-01',
        type: CashMovementType.SALE,
        paymentMethod: SalePaymentMethod.YAPE,
        amount: new Prisma.Decimal(30),
      });

      // Add a CASH_OUT (-20)
      movementsDb.push({
        id: 'mov-out',
        businessId: 'default',
        cashSessionId: session.id,
        storeId: 'store-centro',
        cashRegisterId: 'reg-01',
        type: CashMovementType.CASH_OUT,
        paymentMethod: SalePaymentMethod.CASH,
        amount: new Prisma.Decimal(-20),
      });
    });

    it('Q. Expected cash calcula 200 + 50 - 20 = 230 (Yape no altera efectivo)', async () => {
      const summary = await cashService.calculateSessionSummary(session.id);
      expect(summary.expectedCashAmount).toBe(230);
      expect(summary.yapeSales).toBe(30);
    });

    it('R. Contado exacto (230) da diferencia 0 y tipo CUADRA', async () => {
      const closed = await cashService.closeSession(
        session.id,
        { countedCashAmount: 230 },
        mockUserCajero,
      );

      expect(closed.status).toBe(CashSessionStatus.CLOSED);
      expect(Number(closed.expectedCashAmount)).toBe(230);
      expect(Number(closed.countedCashAmount)).toBe(230);
      expect(Number(closed.differenceAmount)).toBe(0);
      expect(closed.differenceType).toBe('CUADRA');
    });

    it('S. Sobrante (contado 235) da diferencia +5 y tipo SOBRANTE', async () => {
      const closed = await cashService.closeSession(
        session.id,
        { countedCashAmount: 235 },
        mockUserCajero,
      );

      expect(Number(closed.differenceAmount)).toBe(5);
      expect(closed.differenceType).toBe('SOBRANTE');
    });

    it('T. Faltante (contado 228) da diferencia -2 y tipo FALTANTE', async () => {
      const closed = await cashService.closeSession(
        session.id,
        { countedCashAmount: 228 },
        mockUserCajero,
      );

      expect(Number(closed.differenceAmount)).toBe(-2);
      expect(closed.differenceType).toBe('FALTANTE');
    });

    it('U. Segundo cierre sobre sesión ya cerrada es rechazado', async () => {
      await cashService.closeSession(
        session.id,
        { countedCashAmount: 230 },
        mockUserCajero,
      );

      await expect(
        cashService.closeSession(
          session.id,
          { countedCashAmount: 230 },
          mockUserCajero,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 69. TESTS BACKEND — BOLETA SIMPLE Y REIMPRESIÓN
  // =========================================================================
  describe('69. Boleta Simple Interna y Configuración', () => {
    it('W. Numeración atómica genera serie y secuencia correlativa (B001-000001, B001-000002)', async () => {
      const num1 = await cashService.generateNextReceiptNumber(mockPrisma, 'B001');
      const num2 = await cashService.generateNextReceiptNumber(mockPrisma, 'B001');

      expect(num1.number).toBe('B001-000001');
      expect(num2.number).toBe('B001-000002');
      expect(num2.sequence).toBe(2);
    });

    it('X. Reimpresión de boleta conserva número e incrementa contador de copias', async () => {
      receiptsDb.push({
        id: 'rec-001',
        saleId: 'sale-001',
        number: 'B001-000001',
        series: 'B001',
        sequence: 1,
        configSnapshot: DEFAULT_RECEIPT_CONFIG,
        reprintedCount: 0,
      });

      const reprinted = await cashService.reprintReceipt('sale-001', mockUserCajero);
      expect(reprinted.number).toBe('B001-000001');
      expect(reprinted.reprintedCount).toBe(1);
      expect(reprinted.lastReprintedAt).toBeDefined();

      const reprinted2 = await cashService.reprintReceipt('sale-001', mockUserCajero);
      expect(reprinted2.reprintedCount).toBe(2);
    });

    it('Y. Modificación futura de configuración no altera el snapshot histórico de boleta', async () => {
      // 1. Snapshot with initial config
      const initialConfig = await cashService.getReceiptConfig();
      expect(initialConfig.businessName).toBe('CrediManage Comercial');

      receiptsDb.push({
        id: 'rec-hist',
        saleId: 'sale-hist',
        number: 'B001-000010',
        series: 'B001',
        sequence: 10,
        configSnapshot: initialConfig,
        reprintedCount: 0,
      });

      // 2. Update global configuration tomorrow
      await cashService.updateReceiptConfig(
        { businessName: 'CrediManage Superstore 2027' },
        mockUserAdmin,
      );

      const updatedConfig = await cashService.getReceiptConfig();
      expect(updatedConfig.businessName).toBe('CrediManage Superstore 2027');

      // 3. Historical receipt still has original businessName in its snapshot
      const histReceipt = await cashService.getReceiptBySaleId('sale-hist');
      expect((histReceipt.configSnapshot as any).businessName).toBe('CrediManage Comercial');
    });
  });

  // =========================================================================
  // 68. TESTS BACKEND — ADMINISTRACIÓN DE CAJAS (CASH REGISTERS)
  // =========================================================================
  describe('68. Configuración y Administración de Cajas', () => {
    it('A. Administrador crea una caja activa exitosamente', async () => {
      const reg = await cashService.createCashRegister(
        {
          storeId: 'store-centro',
          code: 'CAJA-02',
          name: 'Caja Secundaria',
          status: CashRegisterStatus.ACTIVE,
        },
        mockUserAdmin,
      );

      expect(reg).toBeDefined();
      expect(reg.code).toBe('CAJA-02');
      expect(reg.name).toBe('Caja Secundaria');
      expect(reg.status).toBe(CashRegisterStatus.ACTIVE);
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        mockUserAdmin.id,
        mockUserAdmin.name,
        mockUserAdmin.role,
        'CAJA_CREADA',
        expect.stringContaining('CAJA-02'),
        reg.id,
      );
    });

    it('E. Código duplicado en la misma tienda es rechazado con ConflictException', async () => {
      await expect(
        cashService.createCashRegister(
          {
            storeId: 'store-centro',
            code: 'CAJA-01', // already exists in store-centro
            name: 'Otra Caja 1',
          },
          mockUserAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('F. Mismo código en tienda distinta es permitido (multi-tienda)', async () => {
      const regChorrillos = await cashService.createCashRegister(
        {
          storeId: 'store-chorrillos',
          code: 'CAJA-01', // same code, different store
          name: 'Caja Chorrillos Principal',
        },
        mockUserAdmin,
      );

      expect(regChorrillos).toBeDefined();
      expect(regChorrillos.storeId).toBe('store-chorrillos');
      expect(regChorrillos.code).toBe('CAJA-01');
    });

    it('G. Caja con turno abierto NO puede desactivarse (BadRequestException)', async () => {
      // 1. Open a session on reg-01
      await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 100,
        },
        mockUserCajero,
      );

      // 2. Attempt to deactivate reg-01 while session is OPEN
      await expect(
        cashService.updateCashRegister(
          'reg-01',
          { status: CashRegisterStatus.INACTIVE },
          mockUserAdmin,
        ),
      ).rejects.toThrow('No puedes desactivar esta caja porque tiene un turno abierto.');
    });

    it('H. Caja desactivada conserva historial y no se elimina físicamente', async () => {
      // 1. Open and close a session on reg-01 to generate historical data
      const session = await cashService.openSession(
        {
          cashRegisterId: 'reg-01',
          storeId: 'store-centro',
          openingCashAmount: 100,
        },
        mockUserCajero,
      );
      await cashService.closeSession(
        session.id,
        { countedCashAmount: 100 },
        mockUserCajero,
      );

      // 2. Deactivate register now that session is CLOSED
      const updated = await cashService.updateCashRegister(
        'reg-01',
        { status: CashRegisterStatus.INACTIVE },
        mockUserAdmin,
      );
      expect(updated.status).toBe(CashRegisterStatus.INACTIVE);

      // 3. Verify session still exists and references reg-01
      const histSession = sessionsDb.find((s) => s.id === session.id);
      expect(histSession).toBeDefined();
      expect(histSession.cashRegisterId).toBe('reg-01');
      expect(histSession.status).toBe(CashSessionStatus.CLOSED);

      // 4. Verify register still exists in DB (not physically deleted)
      const registerInDb = registersDb.find((r) => r.id === 'reg-01');
      expect(registerInDb).toBeDefined();
      expect(registerInDb.status).toBe(CashRegisterStatus.INACTIVE);
    });

    it('Permite editar código y nombre de la caja validando unicidad', async () => {
      const updated = await cashService.updateCashRegister(
        'reg-01',
        {
          code: 'CAJA-PRINCIPAL-01',
          name: 'Caja Principal Renovada',
        },
        mockUserAdmin,
      );

      expect(updated.code).toBe('CAJA-PRINCIPAL-01');
      expect(updated.name).toBe('Caja Principal Renovada');
    });
  });
});
