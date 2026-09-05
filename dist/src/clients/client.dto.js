"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPeriodFromDb = mapPeriodFromDb;
exports.toClientDto = toClientDto;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
function mapPeriodFromDb(period) {
    if (period === 'DiaFijo')
        return 'Día Fijo';
    return period || 'Mensual';
}
const zero = new client_1.Prisma.Decimal(0);
function toDecimal(val) {
    if (val === null || val === undefined) {
        return zero;
    }
    if (val instanceof client_1.Prisma.Decimal) {
        return val;
    }
    const str = val.toString().trim();
    if (str === '' || isNaN(Number(str))) {
        return zero;
    }
    return new client_1.Prisma.Decimal(str);
}
function toClientDto(c) {
    if (!c)
        return null;
    if (c.balanceOrigin === 'MIGRATED_BASELINE' ||
        c.balanceOrigin === 'NATIVE_V1' ||
        c.balanceModelVersion === 'BALANCE_MODEL_V1') {
        if (c.dailyDebtBalance == null || c.bankDebtBalance == null) {
            throw new common_1.InternalServerErrorException(`BALANCE_LEDGER_INTEGRITY_ERROR: Client ${c.clientNumber || c.id} has null dailyDebtBalance or bankDebtBalance`);
        }
    }
    if (c.balanceOrigin === 'MIGRATED_BASELINE') {
        const hasActiveSnapshot = Array.isArray(c.openingSnapshots)
            ? c.openingSnapshots.some((s) => s.status === 'ACTIVO' &&
                s.migrationVersion === 'BALANCE_MODEL_V1')
            : false;
        if (!hasActiveSnapshot) {
            throw new common_1.InternalServerErrorException(`BALANCE_LEDGER_INTEGRITY_ERROR: Migrated client ${c.clientNumber || c.id} lacks required active BalanceOpeningSnapshot under BALANCE_MODEL_V1`);
        }
    }
    const dailyDebtDec = toDecimal(c.dailyDebtBalance);
    const bankDebtDec = toDecimal(c.bankDebtBalance);
    const currentBalanceDec = c.currentBalance != null
        ? toDecimal(c.currentBalance)
        : dailyDebtDec.plus(bankDebtDec);
    const creditExposureDec = client_1.Prisma.Decimal.max(zero, dailyDebtDec)
        .plus(bankDebtDec)
        .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
    const creditLimitDec = toDecimal(c.creditLimit).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
    let availableCredit = null;
    if (creditLimitDec.greaterThan(zero)) {
        const availableCreditDec = client_1.Prisma.Decimal.max(zero, creditLimitDec.minus(creditExposureDec)).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        availableCredit = availableCreditDec.toNumber();
    }
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
//# sourceMappingURL=client.dto.js.map