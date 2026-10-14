import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  OpenCashSessionDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  ReceiptConfigDto,
  GetCashSessionsQueryDto,
  GetCashMovementsQueryDto,
} from './cash.dto';
import {
  CashRegisterStatus,
  CashSessionStatus,
  CashMovementType,
  SalePaymentMethod,
  Prisma,
} from '@prisma/client';

export const DEFAULT_RECEIPT_CONFIG = {
  businessName: 'CrediManage Comercial',
  secondaryText: 'Venta de Ropa, Calzado y Accesorios',
  address: 'Av. Principal 123 - Centro Comercial',
  phone: '987 654 321',
  footerMessage: '¡Gracias por su preferencia! Conserve su boleta.',
  paperWidth: '80mm',
  showLogo: false,
  showProductCode: true,
  showCustomer: true,
  showCashier: true,
  showStore: true,
  showPaymentMethods: true,
  series: 'B001',
};

@Injectable()
export class CashService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private settingsService: SettingsService,
  ) {}

  // =========================================================================
  // CAJAS (CASH REGISTERS)
  // =========================================================================

  async createCashRegister(
    dto: CreateCashRegisterDto,
    user: any,
    businessId = 'default',
  ) {
    const store = await this.prisma.location.findFirst({
      where: { id: dto.storeId, businessId, active: true },
    });
    if (!store) {
      throw new NotFoundException('La tienda especificada no existe o está inactiva');
    }

    const existingCode = await this.prisma.cashRegister.findUnique({
      where: {
        storeId_code: {
          storeId: dto.storeId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });
    if (existingCode) {
      throw new ConflictException(
        `Ya existe una caja con el código "${dto.code}" en esta tienda`,
      );
    }

    const register = await this.prisma.cashRegister.create({
      data: {
        businessId,
        storeId: dto.storeId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        status: dto.status || CashRegisterStatus.ACTIVE,
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
      },
    });

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Administrador',
      'CAJA_CREADA',
      `Caja ${register.name} (${register.code}) creada en tienda ${store.name}`,
      register.id,
    );

    return register;
  }

  async getCashRegisters(storeId?: string, businessId = 'default') {
    const where: Prisma.CashRegisterWhereInput = { businessId };
    if (storeId) {
      where.storeId = storeId;
    }

    const registers = await this.prisma.cashRegister.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, code: true } },
        sessions: {
          where: { status: CashSessionStatus.OPEN },
          include: {
            openedByUser: { select: { id: true, name: true, email: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ store: { name: 'asc' } }, { code: 'asc' }],
    });

    return registers.map((reg) => ({
      ...reg,
      activeSession: reg.sessions[0] || null,
    }));
  }

  async updateCashRegister(
    id: string,
    dto: UpdateCashRegisterDto,
    user: any,
    businessId = 'default',
  ) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: { store: true },
    });
    if (!register || register.businessId !== businessId) {
      throw new NotFoundException('Caja no encontrada');
    }

    if (dto.status === CashRegisterStatus.INACTIVE) {
      const openSession = await this.prisma.cashSession.findFirst({
        where: { cashRegisterId: id, status: CashSessionStatus.OPEN },
      });
      if (openSession) {
        throw new BadRequestException(
          'No puedes desactivar esta caja porque tiene un turno abierto.',
        );
      }
    }

    if (dto.code) {
      const newCode = dto.code.trim().toUpperCase();
      if (newCode !== register.code) {
        const existingCode = await this.prisma.cashRegister.findUnique({
          where: {
            storeId_code: {
              storeId: register.storeId,
              code: newCode,
            },
          },
        });
        if (existingCode && existingCode.id !== id) {
          throw new ConflictException(
            `Ya existe una caja con el código "${dto.code}" en esta tienda`,
          );
        }
      }
    }

    const updated = await this.prisma.cashRegister.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
      },
    });

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Administrador',
      'CAJA_ACTUALIZADA',
      `Caja ${updated.name} (${updated.code}) actualizada. Estado: ${updated.status}`,
      updated.id,
    );

    return updated;
  }

  // =========================================================================
  // TURNOS / SESIONES (CASH SESSIONS)
  // =========================================================================

  async getCurrentSession(user: any, storeId?: string, businessId = 'default') {
    const where: Prisma.CashSessionWhereInput = {
      businessId,
      status: CashSessionStatus.OPEN,
    };

    if (storeId) {
      where.storeId = storeId;
    }

    // A cajero sees their own open session, admin can see open session in store or own
    if (user.role === 'Cajero') {
      where.openedByUserId = user.id;
    }

    const session = await this.prisma.cashSession.findFirst({
      where,
      include: {
        cashRegister: true,
        store: { select: { id: true, name: true, code: true } },
        openedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    const summary = await this.calculateSessionSummary(session.id);
    return {
      ...this.sanitizeSession(session),
      summary,
    };
  }

  private sanitizeSession(session: any) {
    if (!session) return session;
    return {
      ...session,
      openingCashAmount: Number(session.openingCashAmount || 0),
      expectedCashAmount:
        session.expectedCashAmount !== null && session.expectedCashAmount !== undefined
          ? Number(session.expectedCashAmount)
          : null,
      countedCashAmount:
        session.countedCashAmount !== null && session.countedCashAmount !== undefined
          ? Number(session.countedCashAmount)
          : null,
      differenceAmount:
        session.differenceAmount !== null && session.differenceAmount !== undefined
          ? Number(session.differenceAmount)
          : null,
    };
  }

  async openSession(dto: OpenCashSessionDto, user: any, businessId = 'default') {
    // 1. Validate Store
    const store = await this.prisma.location.findFirst({
      where: { id: dto.storeId, businessId, active: true },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada o inactiva');
    }

    // 2. Validate Register
    const register = await this.prisma.cashRegister.findFirst({
      where: { id: dto.cashRegisterId, storeId: dto.storeId, businessId },
    });
    if (!register) {
      throw new NotFoundException('Caja no encontrada en la tienda especificada');
    }
    if (register.status !== CashRegisterStatus.ACTIVE) {
      throw new BadRequestException('La caja está inactiva y no puede ser abierta');
    }

    // 3. Validate no other open session for this register
    const existingRegisterSession = await this.prisma.cashSession.findFirst({
      where: {
        cashRegisterId: dto.cashRegisterId,
        status: CashSessionStatus.OPEN,
      },
    });
    if (existingRegisterSession) {
      throw new ConflictException(
        'Esta caja ya cuenta con un turno abierto. Debe cerrarse antes de abrir uno nuevo.',
      );
    }

    // 4. Validate user does not already have an open session in this store
    const existingUserSession = await this.prisma.cashSession.findFirst({
      where: {
        storeId: dto.storeId,
        openedByUserId: user.id,
        status: CashSessionStatus.OPEN,
      },
    });
    if (existingUserSession) {
      throw new ConflictException(
        'Ya tienes un turno abierto en esta tienda. Debes cerrarlo antes de abrir otra caja.',
      );
    }

    const openingAmount = Math.round(Number(dto.openingCashAmount) * 100) / 100;

    // 5. ATOMIC TRANSACTION: Create Session + Initial CashMovement OPENING
    const newSession = await this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.create({
        data: {
          businessId,
          cashRegisterId: dto.cashRegisterId,
          storeId: dto.storeId,
          openedByUserId: user.id,
          openingCashAmount: new Prisma.Decimal(openingAmount),
          status: CashSessionStatus.OPEN,
          notes: dto.notes?.trim() || null,
        },
      });

      // Initial CashMovement for Opening Cash
      await tx.cashMovement.create({
        data: {
          businessId,
          cashSessionId: session.id,
          storeId: dto.storeId,
          cashRegisterId: dto.cashRegisterId,
          type: CashMovementType.OPENING,
          paymentMethod: SalePaymentMethod.CASH,
          amount: new Prisma.Decimal(openingAmount),
          description: 'Apertura de turno (Fondo inicial)',
          notes: dto.notes?.trim() || null,
          createdByUserId: user.id,
        },
      });

      return session;
    });

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Cajero',
      'CASH_SESSION_OPENED',
      `Turno abierto en caja ${register.name} (${store.name}) con fondo inicial de S/ ${openingAmount.toFixed(2)}`,
      newSession.id,
    );

    return this.getSessionById(newSession.id, businessId);
  }

  // =========================================================================
  // ARQUEO Y CÁLCULO DE RESUMEN
  // =========================================================================

  async calculateSessionSummary(sessionId: string, txClient?: Prisma.TransactionClient) {
    const client = txClient || this.prisma;

    const session = await client.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión de caja no encontrada');
    }

    const openingCash = Number(session.openingCashAmount);

    let cashSales = 0;
    let yapeSales = 0;
    let plinSales = 0;
    let cardSales = 0;
    let transferSales = 0;

    let cashIn = 0;
    let cashOut = 0;
    let cashDebtPayments = 0;
    let nonCashDebtPayments = 0;
    let cashLoanPayments = 0;
    let nonCashLoanPayments = 0;
    let cashSaleReversals = 0;
    let nonCashSaleReversals = 0;

    for (const mov of session.movements) {
      const amt = Number(mov.amount);

      switch (mov.type) {
        case CashMovementType.SALE:
          if (mov.paymentMethod === SalePaymentMethod.CASH) cashSales += amt;
          else if (mov.paymentMethod === SalePaymentMethod.YAPE) yapeSales += amt;
          else if (mov.paymentMethod === SalePaymentMethod.PLIN) plinSales += amt;
          else if (mov.paymentMethod === SalePaymentMethod.CARD) cardSales += amt;
          else if (mov.paymentMethod === SalePaymentMethod.TRANSFER) transferSales += amt;
          break;

        case CashMovementType.SALE_REVERSAL:
          if (mov.paymentMethod === SalePaymentMethod.CASH) cashSaleReversals += Math.abs(amt);
          else nonCashSaleReversals += Math.abs(amt);
          break;

        case CashMovementType.CASH_IN:
          cashIn += Math.abs(amt);
          break;

        case CashMovementType.CASH_OUT:
          cashOut += Math.abs(amt);
          break;

        case CashMovementType.DEBT_PAYMENT:
          if (mov.paymentMethod === SalePaymentMethod.CASH) cashDebtPayments += amt;
          else nonCashDebtPayments += amt;
          break;

        case CashMovementType.LOAN_PAYMENT:
          if (mov.paymentMethod === SalePaymentMethod.CASH) cashLoanPayments += amt;
          else nonCashLoanPayments += amt;
          break;

        default:
          break;
      }
    }

    // Find credit sales for this session
    const creditSalesPayments = await client.salePayment.findMany({
      where: {
        sale: {
          cashSessionId: sessionId,
          status: { not: 'ANULLED' },
        },
        method: SalePaymentMethod.CREDIT,
      },
    });

    const creditSales = creditSalesPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    // Number of completed non-annulled sales in this session
    const salesCount = await client.sale.count({
      where: {
        cashSessionId: sessionId,
        status: { not: 'ANULLED' },
      },
    });

    // Net expected cash in physical drawer:
    // Opening + CASH sales + CASH IN + CASH debt + CASH loan - CASH OUT - CASH reversals
    const expectedCashAmount =
      Math.round(
        (openingCash +
          cashSales +
          cashIn +
          cashDebtPayments +
          cashLoanPayments -
          cashOut -
          cashSaleReversals) *
          100,
      ) / 100;

    const totalSalesAmount =
      Math.round(
        (cashSales + yapeSales + plinSales + cardSales + transferSales + creditSales) * 100,
      ) / 100;

    return {
      openingCash: Math.round(openingCash * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      yapeSales: Math.round(yapeSales * 100) / 100,
      plinSales: Math.round(plinSales * 100) / 100,
      cardSales: Math.round(cardSales * 100) / 100,
      transferSales: Math.round(transferSales * 100) / 100,
      creditSales: Math.round(creditSales * 100) / 100,
      cashIn: Math.round(cashIn * 100) / 100,
      cashOut: Math.round(cashOut * 100) / 100,
      cashDebtPayments: Math.round(cashDebtPayments * 100) / 100,
      cashLoanPayments: Math.round(cashLoanPayments * 100) / 100,
      cashSaleReversals: Math.round(cashSaleReversals * 100) / 100,
      expectedCashAmount,
      totalSalesAmount,
      salesCount,
      // Methods total summary
      methodsSummary: {
        CASH: Math.round(
          (cashSales + cashIn + cashDebtPayments + cashLoanPayments - cashOut - cashSaleReversals) * 100,
        ) / 100,
        YAPE: Math.round((yapeSales + nonCashDebtPayments) * 100) / 100,
        PLIN: Math.round(plinSales * 100) / 100,
        CARD: Math.round(cardSales * 100) / 100,
        TRANSFER: Math.round(transferSales * 100) / 100,
        CREDIT: Math.round(creditSales * 100) / 100,
      },
    };
  }

  // =========================================================================
  // MOVIMIENTOS MANUALES (INGRESO / RETIRO)
  // =========================================================================

  async checkMovementPermission(user: any, type: 'CASH_IN' | 'CASH_OUT'): Promise<void> {
    if (!user || !user.id) {
      throw new UnauthorizedException('No autenticado. Inicie sesión para continuar.');
    }

    if (user.role === 'Administrador') {
      return;
    }

    let permissions: string[] = user.permissions || [];
    if ((!user.permissions || user.permissions.length === 0) && user.id && this.prisma?.user) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          roleEntity: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      });
      if (dbUser?.roleEntity?.permissions) {
        permissions = dbUser.roleEntity.permissions.map((rp: any) => rp.permission.code);
      } else if (dbUser?.role && this.prisma?.role) {
        const role = await this.prisma.role.findUnique({
          where: { name: dbUser.role },
          include: { permissions: { include: { permission: true } } },
        });
        if (role?.permissions) {
          permissions = role.permissions.map((rp: any) => rp.permission.code);
        }
      }
    }

    if (type === 'CASH_IN') {
      const canIn =
        permissions.includes('cash.cash_in') ||
        permissions.includes('CAJA_INGRESAR_EFECTIVO');
      if (!canIn) {
        throw new ForbiddenException(
          'No tienes permiso para registrar ingresos manuales de caja.',
        );
      }
    } else if (type === 'CASH_OUT') {
      const canOut =
        permissions.includes('cash.cash_out') ||
        permissions.includes('CAJA_RETIRAR_EFECTIVO');
      if (!canOut) {
        throw new ForbiddenException(
          'No tienes permiso para registrar retiros de caja.',
        );
      }
    }
  }

  async addManualMovement(
    sessionId: string,
    dto: CreateCashMovementDto,
    user: any,
    businessId = 'default',
  ) {
    // 1. Validar permisos explícitos de caja
    await this.checkMovementPermission(user, dto.type);

    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        cashRegister: true,
        store: true,
      },
    });

    if (!session || session.businessId !== businessId) {
      throw new NotFoundException('Sesión de caja no encontrada');
    }
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException(
        'El turno está cerrado. No se pueden registrar movimientos en una sesión cerrada.',
      );
    }

    const currentSummary = await this.calculateSessionSummary(sessionId);
    const amountVal = Math.round(Math.abs(dto.amount) * 100) / 100;
    const signedAmount = dto.type === 'CASH_OUT' ? -amountVal : amountVal;

    const projectedCash =
      dto.type === 'CASH_OUT'
        ? Math.round((currentSummary.expectedCashAmount - amountVal) * 100) / 100
        : Math.round((currentSummary.expectedCashAmount + amountVal) * 100) / 100;

    let warning: string | null = null;
    if (projectedCash < 0) {
      warning = `Este movimiento dejará la caja con un efectivo esperado negativo de S/ ${projectedCash.toFixed(2)}.`;
    }

    const movement = await this.prisma.cashMovement.create({
      data: {
        businessId,
        cashSessionId: sessionId,
        storeId: session.storeId,
        cashRegisterId: session.cashRegisterId,
        type:
          dto.type === 'CASH_IN'
            ? CashMovementType.CASH_IN
            : CashMovementType.CASH_OUT,
        paymentMethod: SalePaymentMethod.CASH,
        amount: new Prisma.Decimal(signedAmount),
        description: dto.reason.trim(),
        notes: dto.notes?.trim() || null,
        createdByUserId: user.id,
      },
    });

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Cajero',
      dto.type === 'CASH_IN' ? 'CASH_IN' : 'CASH_OUT',
      `${dto.type === 'CASH_IN' ? 'Ingreso' : 'Retiro'} manual de S/ ${amountVal.toFixed(2)} en caja ${session.cashRegister.name}. Motivo: ${dto.reason.trim()}`,
      movement.id,
    );

    const updatedSummary = await this.calculateSessionSummary(sessionId);

    return {
      movement,
      summary: updatedSummary,
      warning,
    };
  }

  // =========================================================================
  // CIERRE DE TURNO
  // =========================================================================

  async closeSession(
    sessionId: string,
    dto: CloseCashSessionDto,
    user: any,
    businessId = 'default',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findUnique({
        where: { id: sessionId },
        include: { cashRegister: true, store: true },
      });

      if (!session || session.businessId !== businessId) {
        throw new NotFoundException('Sesión de caja no encontrada');
      }
      if (session.status === CashSessionStatus.CLOSED) {
        throw new BadRequestException('Esta sesión de caja ya se encuentra cerrada');
      }

      // Re-calculate expected cash within transaction
      const summary = await this.calculateSessionSummary(sessionId, tx);
      const expectedCash = summary.expectedCashAmount;
      const countedCash = Math.round(Number(dto.countedCashAmount) * 100) / 100;
      const difference = Math.round((countedCash - expectedCash) * 100) / 100;

      const closedSession = await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: CashSessionStatus.CLOSED,
          closedAt: new Date(),
          closedByUserId: user.id,
          expectedCashAmount: new Prisma.Decimal(expectedCash),
          countedCashAmount: new Prisma.Decimal(countedCash),
          differenceAmount: new Prisma.Decimal(difference),
          notes: dto.notes?.trim() || session.notes,
        },
      });

      let diffType = 'Cuadra';
      if (difference > 0) diffType = `Sobrante (+S/ ${difference.toFixed(2)})`;
      else if (difference < 0) diffType = `Faltante (-S/ ${Math.abs(difference).toFixed(2)})`;

      await this.auditService.logAudit(
        user.id,
        user.name || 'Usuario',
        user.role || 'Cajero',
        'CASH_SESSION_CLOSED',
        `Turno cerrado en ${session.cashRegister.name}. Esperado: S/ ${expectedCash.toFixed(2)}, Contado: S/ ${countedCash.toFixed(2)}, Diferencia: ${diffType}`,
        closedSession.id,
      );

      return {
        ...this.sanitizeSession(closedSession),
        summary,
        differenceType: difference === 0 ? 'CUADRA' : difference > 0 ? 'SOBRANTE' : 'FALTANTE',
      };
    });
  }

  // =========================================================================
  // CONSULTAS HISTÓRICAS
  // =========================================================================

  async getSessionById(sessionId: string, businessId = 'default') {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        cashRegister: true,
        store: { select: { id: true, name: true, code: true } },
        openedByUser: { select: { id: true, name: true, email: true } },
        closedByUser: { select: { id: true, name: true, email: true } },
        movements: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: { select: { id: true, name: true } },
          },
        },
        sales: {
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { id: true, name: true, clientNumber: true } },
            payments: true,
            receipt: true,
          },
        },
      },
    });

    if (!session || session.businessId !== businessId) {
      throw new NotFoundException('Sesión de caja no encontrada');
    }

    const summary = await this.calculateSessionSummary(session.id);
    return {
      ...this.sanitizeSession(session),
      summary,
    };
  }

  async getSessionsHistory(query: GetCashSessionsQueryDto, businessId = 'default') {
    const where: Prisma.CashSessionWhereInput = { businessId };

    if (query.storeId) where.storeId = query.storeId;
    if (query.cashRegisterId) where.cashRegisterId = query.cashRegisterId;
    if (query.userId) where.openedByUserId = query.userId;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.openedAt = {};
      if (query.startDate) where.openedAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.openedAt.lte = end;
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, sessions] = await Promise.all([
      this.prisma.cashSession.count({ where }),
      this.prisma.cashSession.findMany({
        where,
        include: {
          cashRegister: true,
          store: { select: { id: true, name: true, code: true } },
          openedByUser: { select: { id: true, name: true, email: true } },
          closedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: sessions.map((s) => this.sanitizeSession(s)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMovements(query: GetCashMovementsQueryDto, businessId = 'default') {
    const where: Prisma.CashMovementWhereInput = { businessId };

    if (query.cashSessionId) where.cashSessionId = query.cashSessionId;
    if (query.storeId) where.storeId = query.storeId;
    if (query.type) where.type = query.type;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const skip = (page - 1) * limit;

    const [total, movements] = await Promise.all([
      this.prisma.cashMovement.count({ where }),
      this.prisma.cashMovement.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          cashRegister: { select: { id: true, name: true, code: true } },
          createdByUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: movements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // CONFIGURACIÓN DE COMPROBANTE / BOLETA
  // =========================================================================

  async getReceiptConfig(storeId?: string, businessId = 'default') {
    const settingKey = storeId ? `receipt_config_${storeId}` : 'receipt_config';
    let val = await this.settingsService.getSetting(settingKey);

    if (!val && storeId) {
      // Fallback to global config
      val = await this.settingsService.getSetting('receipt_config');
    }

    if (!val) {
      return DEFAULT_RECEIPT_CONFIG;
    }

    try {
      return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(val) };
    } catch {
      return DEFAULT_RECEIPT_CONFIG;
    }
  }

  async updateReceiptConfig(
    dto: ReceiptConfigDto,
    user: any,
    storeId?: string,
    businessId = 'default',
  ) {
    const settingKey = storeId ? `receipt_config_${storeId}` : 'receipt_config';
    const current = await this.getReceiptConfig(storeId, businessId);
    const merged = { ...current, ...dto };

    await this.settingsService.setSetting(
      settingKey,
      JSON.stringify(merged),
      user,
      'Configuración de Boleta de Venta Simple',
    );

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Administrador',
      'RECEIPT_CONFIG_UPDATED',
      `Configuración de boleta actualizada${storeId ? ` para tienda ${storeId}` : ' globalmente'}`,
      settingKey,
    );

    return merged;
  }

  // =========================================================================
  // BOLETAS / RECEIPTS
  // =========================================================================

  /**
   * Generates next receipt number atomically using ReceiptSequence counter table
   */
  async generateNextReceiptNumber(
    tx: Prisma.TransactionClient,
    series = 'B001',
    businessId = 'default',
  ): Promise<{ number: string; sequence: number; series: string }> {
    // Atomic upsert with Postgres increment returning sequence
    const result: Array<{ currentSequence: number }> = await tx.$queryRaw`
      INSERT INTO "ReceiptSequence" ("id", "businessId", "series", "currentSequence", "updatedAt")
      VALUES (gen_random_uuid(), ${businessId}, ${series}, 1, NOW())
      ON CONFLICT ("businessId", "series")
      DO UPDATE SET "currentSequence" = "ReceiptSequence"."currentSequence" + 1, "updatedAt" = NOW()
      RETURNING "currentSequence";
    `;

    const seq = result[0]?.currentSequence || 1;
    const number = `${series}-${String(seq).padStart(6, '0')}`;
    return { number, sequence: seq, series };
  }

  async getReceiptBySaleId(saleId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { saleId },
      include: {
        sale: {
          include: {
            items: true,
            payments: true,
            store: true,
            client: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Comprobante no encontrado para esta venta');
    }

    return receipt;
  }

  async reprintReceipt(saleId: string, user: any) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { saleId },
      include: {
        sale: {
          include: {
            items: true,
            payments: true,
            store: true,
            client: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Comprobante no encontrado para esta venta');
    }

    const updated = await this.prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        reprintedCount: { increment: 1 },
        lastReprintedAt: new Date(),
      },
      include: {
        sale: {
          include: {
            items: true,
            payments: true,
            store: true,
            client: true,
          },
        },
      },
    });

    await this.auditService.logAudit(
      user.id,
      user.name || 'Usuario',
      user.role || 'Cajero',
      'RECEIPT_REPRINTED',
      `Boleta ${updated.number} reimpresa por ${user.name || 'Usuario'} (Copia #${updated.reprintedCount})`,
      updated.id,
    );

    return updated;
  }
}
