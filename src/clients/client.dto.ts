import { Prisma } from '@prisma/client';
import { InternalServerErrorException } from '@nestjs/common';

export interface ClientResponseDto {
  id: string;
  clientNumber: string;
  name: string;
  phone: string;
  address: string;
  creditLimit: number;
  currentBalance: number;
  dailyDebtBalance: number;
  bankDebtBalance: number;
  creditExposure: number;
  availableCredit: number | null;
  paymentPeriod: string;
  paymentDay: string;
  nextDueDate: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function mapPeriodFromDb(period: any): string {
  if (period === 'DiaFijo') return 'Día Fijo';
  return period || 'Mensual';
}

const zero = new Prisma.Decimal(0);

function toDecimal(val: any): Prisma.Decimal {
  if (val === null || val === undefined) {
    return zero;
  }
  if (val instanceof Prisma.Decimal) {
    return val;
  }
  const str = val.toString().trim();
  if (str === '' || isNaN(Number(str))) {
    return zero;
  }
  return new Prisma.Decimal(str);
}

export function toClientDto(c: any): ClientResponseDto | null {
  if (!c) return null;

  // 1. Integridad de saldos materializados: no se admiten saldos NULL
  if (
    c.balanceOrigin === 'MIGRATED_BASELINE' ||
    c.balanceOrigin === 'NATIVE_V1' ||
    c.balanceModelVersion === 'BALANCE_MODEL_V1'
  ) {
    if (c.dailyDebtBalance == null || c.bankDebtBalance == null) {
      throw new InternalServerErrorException(
        `BALANCE_LEDGER_INTEGRITY_ERROR: Client ${c.clientNumber || c.id} has null dailyDebtBalance or bankDebtBalance`,
      );
    }
  }

  // 2. Integridad de snapshot: MIGRATED_BASELINE requiere exactamente BalanceOpeningSnapshot ACTIVO en BALANCE_MODEL_V1
  if (c.balanceOrigin === 'MIGRATED_BASELINE') {
    const hasActiveSnapshot = Array.isArray(c.openingSnapshots)
      ? c.openingSnapshots.some(
          (s: any) =>
            s.status === 'ACTIVO' && s.migrationVersion === 'BALANCE_MODEL_V1',
        )
      : false;

    if (!hasActiveSnapshot) {
      throw new InternalServerErrorException(
        `BALANCE_LEDGER_INTEGRITY_ERROR: Migrated client ${c.clientNumber || c.id} lacks required active BalanceOpeningSnapshot under BALANCE_MODEL_V1`,
      );
    }
  }

  // 3. Cálculos monetarios estrictamente con Prisma.Decimal
  const dailyDebtDec = toDecimal(c.dailyDebtBalance);
  const bankDebtDec = toDecimal(c.bankDebtBalance);

  // currentBalance: si viene en el registro se normaliza con toDecimal, si no, es daily + bank
  const currentBalanceDec =
    c.currentBalance != null
      ? toDecimal(c.currentBalance)
      : dailyDebtDec.plus(bankDebtDec);

  // creditExposure = max(0, dailyDebtBalance) + bankDebtBalance
  // Saldo a favor en cuenta corriente (daily < 0) NO aumenta crédito contractual
  const creditExposureDec = Prisma.Decimal.max(zero, dailyDebtDec)
    .plus(bankDebtDec)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const creditLimitDec = toDecimal(c.creditLimit).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );

  // availableCredit: null si creditLimit <= 0 (Sin límite), max(0, creditLimit - creditExposure) si > 0
  let availableCredit: number | null = null;
  if (creditLimitDec.greaterThan(zero)) {
    const availableCreditDec = Prisma.Decimal.max(
      zero,
      creditLimitDec.minus(creditExposureDec),
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    availableCredit = availableCreditDec.toNumber();
  }

  // 4. Retornar DTO público purificado (convirtiendo Decimals a number con .toNumber())
  // Excluye rigurosamente: balanceModelVersion, balanceOrigin, openingSnapshots, adjustments, isBaselineMovement, etc.
  return {
    id: c.id,
    clientNumber: c.clientNumber,
    name: c.name,
    phone: c.phone || '',
    address: c.address || '',
    creditLimit: creditLimitDec.toNumber(),
    currentBalance: currentBalanceDec.toNumber(),
    dailyDebtBalance: dailyDebtDec.toNumber(),
    bankDebtBalance: bankDebtDec.toNumber(),
    creditExposure: creditExposureDec.toNumber(),
    availableCredit,
    paymentPeriod: mapPeriodFromDb(c.paymentPeriod),
    paymentDay: c.paymentDay || '',
    nextDueDate: c.nextDueDate || '',
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
