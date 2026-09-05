import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SyncBalancesResult {
  dailyDebtBalance: number;
  bankDebtBalance: number;
  currentBalance: number;
  creditExposure: number;
  availableCredit: number | 'Sin límite';
  dailyDebtBalanceDecimal: Prisma.Decimal;
  bankDebtBalanceDecimal: Prisma.Decimal;
  currentBalanceDecimal: Prisma.Decimal;
  creditExposureDecimal: Prisma.Decimal;
  subsequentChargesSum: Prisma.Decimal;
  subsequentDailyPaymentsSum: Prisma.Decimal;
  subsequentAdjustmentsSum: Prisma.Decimal;
}

export function validatePaymentAllocations(
  paymentAmount: number | Prisma.Decimal,
  targetType: string | null | undefined,
  allocations: any[],
  loanIdReceived?: string,
  validClientLoanIds?: string[]
) {
  const payAmountDec = new Prisma.Decimal(paymentAmount.toString());

  if (targetType === 'legacyUnknown') {
    throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: targetType legacyUnknown está estrictamente prohibido en nuevos pagos.');
  }

  if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
    if (targetType !== 'dailyDebt' && targetType !== 'bankLoan') {
      throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: El pago no posee allocations ni targetType válido.');
    }
    return;
  }

  let sumAllocations = new Prisma.Decimal(0);
  let hasDaily = false;
  let hasBank = false;

  for (const alloc of allocations) {
    if (alloc.amount === undefined || alloc.amount === null) {
      throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Toda allocation debe especificar un monto.');
    }
    const allocAmountDec = new Prisma.Decimal(alloc.amount.toString());
    if (allocAmountDec.lessThanOrEqualTo(new Prisma.Decimal(0))) {
      throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: El monto de cada allocation debe ser mayor a S/ 0.00.');
    }
    sumAllocations = sumAllocations.plus(allocAmountDec);

    const allocType = alloc.targetType || alloc.type;
    if (allocType === 'dailyDebt') {
      hasDaily = true;
    } else if (allocType === 'bankLoan') {
      hasBank = true;
      if (!alloc.loanId) {
        throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Toda allocation bancaria debe especificar loanId.');
      }
      if (loanIdReceived && alloc.loanId !== loanIdReceived) {
        throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Allocation bancaria apunta a un préstamo (${alloc.loanId}) distinto al objetivo (${loanIdReceived}).`);
      }
      if (validClientLoanIds && !validClientLoanIds.includes(alloc.loanId)) {
        throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: El préstamo (${alloc.loanId}) no pertenece al cliente del pago.`);
      }
      if (alloc.installmentNumber !== undefined && alloc.installmentNumber !== null) {
        const instNum = Number(alloc.installmentNumber);
        if (isNaN(instNum) || instNum <= 0) {
          throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: installmentNumber inválido: ${alloc.installmentNumber}`);
        }
      }
    } else {
      throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Tipo de allocation desconocido: ${allocType}`);
    }
  }

  if (!sumAllocations.equals(payAmountDec)) {
    throw new BadRequestException(
      `BALANCE_LEDGER_INTEGRITY_ERROR: La suma de allocations (${sumAllocations.toFixed(2)}) no coincide con el importe total del pago (${payAmountDec.toFixed(2)}).`
    );
  }

  if (targetType === 'dailyDebt' && hasBank) {
    throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como dailyDebt no puede contener allocations bancarias.');
  }

  if (targetType === 'bankLoan' && hasDaily) {
    throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como bankLoan no puede contener allocations de deuda corriente.');
  }

  if (targetType === 'legacyMixed' && (!hasDaily || !hasBank)) {
    throw new BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como legacyMixed debe involucrar tanto deuda corriente como bancaria.');
  }
}

@Injectable()
export class BalanceSyncService {
  constructor(private prisma: PrismaService) {}

  async syncClientBalances(
    clientId: string,
    tx?: Prisma.TransactionClient | any
  ): Promise<SyncBalancesResult> {
    const db = tx || this.prisma;

    const client = await db.client.findUnique({
      where: { id: clientId },
      include: {
        openingSnapshots: {
          where: { migrationVersion: 'BALANCE_MODEL_V1', status: 'ACTIVO' },
          take: 1,
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${clientId} no encontrado para sincronización de saldos`);
    }

    const snapshot = client.openingSnapshots && client.openingSnapshots.length > 0 ? client.openingSnapshots[0] : null;

    // Determine Base Balances
    let baseDailyDebt = new Prisma.Decimal(0);
    let baseBankDebt = new Prisma.Decimal(0);
    const hasSnapshot = snapshot !== null;
    const cutOffDate: Date | null = hasSnapshot ? new Date(snapshot.cutOffDate) : null;

    if (hasSnapshot) {
      baseDailyDebt = new Prisma.Decimal(snapshot.dailyDebtOpeningBalance.toString());
      baseBankDebt = new Prisma.Decimal(snapshot.bankDebtOpeningBalance.toString());
    }

    // 1. Fetch Purchases
    const purchases = await db.creditPurchase.findMany({
      where: { clientId },
    });

    let subsequentChargesSum = new Prisma.Decimal(0);
    for (const p of purchases) {
      const isBaseline = p.isBaselineMovement === true;
      const isPost = !isBaseline && (!hasSnapshot || (p.createdAt !== null && new Date(p.createdAt) > cutOffDate!));

      if (isPost && p.status === 'Activo' && !p.loanId && p.debtType !== 'credit') {
        subsequentChargesSum = subsequentChargesSum.plus(new Prisma.Decimal(p.amount.toString()));
      }
    }

    // 2. Fetch Payments
    const payments = await db.payment.findMany({
      where: { clientId },
    });

    let subsequentDailyPaymentsSum = new Prisma.Decimal(0);
    for (const pay of payments) {
      const isBaseline = pay.isBaselineMovement === true;
      const isPost = !isBaseline && (!hasSnapshot || (pay.createdAt !== null && new Date(pay.createdAt) > cutOffDate!));

      if (!isPost) continue;
      if (pay.status !== 'Activo') continue;

      // Strict integrity check on post-snapshot payments
      if (pay.targetType === 'legacyUnknown') {
        throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Pago ${pay.id} clasificado como legacyUnknown en ledger post-snapshot.`);
      }

      const hasAllocations = pay.allocations && Array.isArray(pay.allocations) && pay.allocations.length > 0;
      const validTargetTypes = ['dailyDebt', 'bankLoan', 'legacyMixed', 'legacyDirect'];
      const hasValidTarget = pay.targetType && validTargetTypes.includes(pay.targetType);

      if (!hasAllocations && !hasValidTarget) {
        throw new BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Pago ${pay.id} post-snapshot sin targetType ni allocations válidas.`);
      }

      if (hasAllocations) {
        validatePaymentAllocations(pay.amount, pay.targetType, pay.allocations as any[]);
        for (const alloc of pay.allocations as any[]) {
          const aType = alloc.targetType || alloc.type;
          if (aType === 'dailyDebt') {
            subsequentDailyPaymentsSum = subsequentDailyPaymentsSum.plus(new Prisma.Decimal(alloc.amount.toString()));
          }
        }
      } else if (pay.targetType === 'dailyDebt' || pay.targetType === 'legacyDirect') {
        subsequentDailyPaymentsSum = subsequentDailyPaymentsSum.plus(new Prisma.Decimal(pay.amount.toString()));
      }
      // bankLoan targetType does not affect daily debt
    }

    // 3. Fetch BalanceAdjustments
    const adjustments = await db.balanceAdjustment.findMany({
      where: { clientId },
    });

    let subsequentAdjustmentsSum = new Prisma.Decimal(0);
    for (const adj of adjustments) {
      if (adj.status !== 'ACTIVO') continue;
      const isPost = !hasSnapshot || (adj.createdAt !== null && new Date(adj.createdAt) > cutOffDate!);
      if (!isPost) continue;

      if (adj.type === 'DAILY_PAYMENT_REVERSAL') {
        // Payment annulment restores debt (increases daily debt)
        subsequentAdjustmentsSum = subsequentAdjustmentsSum.plus(new Prisma.Decimal(adj.amount.toString()));
      } else if (adj.type === 'DAILY_DEBT_REVERSAL') {
        // Purchase annulment removes debt (decreases daily debt)
        subsequentAdjustmentsSum = subsequentAdjustmentsSum.minus(new Prisma.Decimal(adj.amount.toString()));
      } else if (adj.type === 'MIGRATION_ADJUSTMENT') {
        subsequentAdjustmentsSum = subsequentAdjustmentsSum.plus(new Prisma.Decimal(adj.amount.toString()));
      }
    }

    // 4. Calculate Daily Debt Balance
    const dailyDebtBalanceDecimal = baseDailyDebt
      .plus(subsequentChargesSum)
      .minus(subsequentDailyPaymentsSum)
      .plus(subsequentAdjustmentsSum)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // 5. Calculate Bank Debt Balance
    const activeLoans = await db.loan.findMany({
      where: {
        clientId,
        status: { in: ['Activo', 'Vencido'] },
      },
    });

    let bankDebtBalanceDecimal = new Prisma.Decimal(0);
    for (const loan of activeLoans) {
      const pendingDec = new Prisma.Decimal(loan.pendingAmount.toString());
      bankDebtBalanceDecimal = bankDebtBalanceDecimal.plus(
        Prisma.Decimal.max(new Prisma.Decimal(0), pendingDec)
      );
    }
    bankDebtBalanceDecimal = bankDebtBalanceDecimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // 6. Current Balance & Exposure
    const currentBalanceDecimal = dailyDebtBalanceDecimal
      .plus(bankDebtBalanceDecimal)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const creditExposureDecimal = Prisma.Decimal.max(new Prisma.Decimal(0), dailyDebtBalanceDecimal)
      .plus(bankDebtBalanceDecimal)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const creditLimitDecimal = new Prisma.Decimal(
      (client.creditLimit != null ? client.creditLimit : 0).toString(),
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const availableCredit = creditLimitDecimal.greaterThan(new Prisma.Decimal(0))
      ? Prisma.Decimal.max(
          new Prisma.Decimal(0),
          creditLimitDecimal.minus(creditExposureDecimal),
        ).toNumber()
      : 'Sin límite';

    // 7. Validate Invariants
    if (!dailyDebtBalanceDecimal.plus(bankDebtBalanceDecimal).equals(currentBalanceDecimal)) {
      throw new BadRequestException(
        `BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: dailyDebt (${dailyDebtBalanceDecimal.toFixed(2)}) + bankDebt (${bankDebtBalanceDecimal.toFixed(2)}) != currentBalance (${currentBalanceDecimal.toFixed(2)})`
      );
    }

    if (bankDebtBalanceDecimal.lessThan(new Prisma.Decimal(0))) {
      throw new BadRequestException(
        `BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: bankDebtBalance no puede ser negativo (${bankDebtBalanceDecimal.toFixed(2)})`
      );
    }

    if (creditExposureDecimal.lessThan(bankDebtBalanceDecimal)) {
      throw new BadRequestException(
        `BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: creditExposure (${creditExposureDecimal.toFixed(2)}) no puede ser menor a bankDebt (${bankDebtBalanceDecimal.toFixed(2)})`
      );
    }

    // 8. Atomic update on Client
    await db.client.update({
      where: { id: clientId },
      data: {
        dailyDebtBalance: dailyDebtBalanceDecimal,
        bankDebtBalance: bankDebtBalanceDecimal,
        currentBalance: currentBalanceDecimal.toNumber(),
      },
    });

    return {
      dailyDebtBalance: dailyDebtBalanceDecimal.toNumber(),
      bankDebtBalance: bankDebtBalanceDecimal.toNumber(),
      currentBalance: currentBalanceDecimal.toNumber(),
      creditExposure: creditExposureDecimal.toNumber(),
      availableCredit,
      dailyDebtBalanceDecimal,
      bankDebtBalanceDecimal,
      currentBalanceDecimal,
      creditExposureDecimal,
      subsequentChargesSum,
      subsequentDailyPaymentsSum,
      subsequentAdjustmentsSum,
    };
  }
}
