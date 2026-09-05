"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceSyncService = void 0;
exports.validatePaymentAllocations = validatePaymentAllocations;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
function validatePaymentAllocations(paymentAmount, targetType, allocations, loanIdReceived, validClientLoanIds) {
    const payAmountDec = new client_1.Prisma.Decimal(paymentAmount.toString());
    if (targetType === 'legacyUnknown') {
        throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: targetType legacyUnknown está estrictamente prohibido en nuevos pagos.');
    }
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
        if (targetType !== 'dailyDebt' && targetType !== 'bankLoan') {
            throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: El pago no posee allocations ni targetType válido.');
        }
        return;
    }
    let sumAllocations = new client_1.Prisma.Decimal(0);
    let hasDaily = false;
    let hasBank = false;
    for (const alloc of allocations) {
        if (alloc.amount === undefined || alloc.amount === null) {
            throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Toda allocation debe especificar un monto.');
        }
        const allocAmountDec = new client_1.Prisma.Decimal(alloc.amount.toString());
        if (allocAmountDec.lessThanOrEqualTo(new client_1.Prisma.Decimal(0))) {
            throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: El monto de cada allocation debe ser mayor a S/ 0.00.');
        }
        sumAllocations = sumAllocations.plus(allocAmountDec);
        const allocType = alloc.targetType || alloc.type;
        if (allocType === 'dailyDebt') {
            hasDaily = true;
        }
        else if (allocType === 'bankLoan') {
            hasBank = true;
            if (!alloc.loanId) {
                throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Toda allocation bancaria debe especificar loanId.');
            }
            if (loanIdReceived && alloc.loanId !== loanIdReceived) {
                throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Allocation bancaria apunta a un préstamo (${alloc.loanId}) distinto al objetivo (${loanIdReceived}).`);
            }
            if (validClientLoanIds && !validClientLoanIds.includes(alloc.loanId)) {
                throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: El préstamo (${alloc.loanId}) no pertenece al cliente del pago.`);
            }
            if (alloc.installmentNumber !== undefined && alloc.installmentNumber !== null) {
                const instNum = Number(alloc.installmentNumber);
                if (isNaN(instNum) || instNum <= 0) {
                    throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: installmentNumber inválido: ${alloc.installmentNumber}`);
                }
            }
        }
        else {
            throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Tipo de allocation desconocido: ${allocType}`);
        }
    }
    if (!sumAllocations.equals(payAmountDec)) {
        throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: La suma de allocations (${sumAllocations.toFixed(2)}) no coincide con el importe total del pago (${payAmountDec.toFixed(2)}).`);
    }
    if (targetType === 'dailyDebt' && hasBank) {
        throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como dailyDebt no puede contener allocations bancarias.');
    }
    if (targetType === 'bankLoan' && hasDaily) {
        throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como bankLoan no puede contener allocations de deuda corriente.');
    }
    if (targetType === 'legacyMixed' && (!hasDaily || !hasBank)) {
        throw new common_1.BadRequestException('BALANCE_LEDGER_INTEGRITY_ERROR: Pago clasificado como legacyMixed debe involucrar tanto deuda corriente como bancaria.');
    }
}
let BalanceSyncService = class BalanceSyncService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async syncClientBalances(clientId, tx) {
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
            throw new common_1.NotFoundException(`Cliente ${clientId} no encontrado para sincronización de saldos`);
        }
        const snapshot = client.openingSnapshots && client.openingSnapshots.length > 0 ? client.openingSnapshots[0] : null;
        let baseDailyDebt = new client_1.Prisma.Decimal(0);
        let baseBankDebt = new client_1.Prisma.Decimal(0);
        const hasSnapshot = snapshot !== null;
        const cutOffDate = hasSnapshot ? new Date(snapshot.cutOffDate) : null;
        if (hasSnapshot) {
            baseDailyDebt = new client_1.Prisma.Decimal(snapshot.dailyDebtOpeningBalance.toString());
            baseBankDebt = new client_1.Prisma.Decimal(snapshot.bankDebtOpeningBalance.toString());
        }
        const purchases = await db.creditPurchase.findMany({
            where: { clientId },
        });
        let subsequentChargesSum = new client_1.Prisma.Decimal(0);
        for (const p of purchases) {
            const isBaseline = p.isBaselineMovement === true;
            const isPost = !isBaseline && (!hasSnapshot || (p.createdAt !== null && new Date(p.createdAt) > cutOffDate));
            if (isPost && p.status === 'Activo' && !p.loanId && p.debtType !== 'credit') {
                subsequentChargesSum = subsequentChargesSum.plus(new client_1.Prisma.Decimal(p.amount.toString()));
            }
        }
        const payments = await db.payment.findMany({
            where: { clientId },
        });
        let subsequentDailyPaymentsSum = new client_1.Prisma.Decimal(0);
        for (const pay of payments) {
            const isBaseline = pay.isBaselineMovement === true;
            const isPost = !isBaseline && (!hasSnapshot || (pay.createdAt !== null && new Date(pay.createdAt) > cutOffDate));
            if (!isPost)
                continue;
            if (pay.status !== 'Activo')
                continue;
            if (pay.targetType === 'legacyUnknown') {
                throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Pago ${pay.id} clasificado como legacyUnknown en ledger post-snapshot.`);
            }
            const hasAllocations = pay.allocations && Array.isArray(pay.allocations) && pay.allocations.length > 0;
            const validTargetTypes = ['dailyDebt', 'bankLoan', 'legacyMixed', 'legacyDirect'];
            const hasValidTarget = pay.targetType && validTargetTypes.includes(pay.targetType);
            if (!hasAllocations && !hasValidTarget) {
                throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Pago ${pay.id} post-snapshot sin targetType ni allocations válidas.`);
            }
            if (hasAllocations) {
                validatePaymentAllocations(pay.amount, pay.targetType, pay.allocations);
                for (const alloc of pay.allocations) {
                    const aType = alloc.targetType || alloc.type;
                    if (aType === 'dailyDebt') {
                        subsequentDailyPaymentsSum = subsequentDailyPaymentsSum.plus(new client_1.Prisma.Decimal(alloc.amount.toString()));
                    }
                }
            }
            else if (pay.targetType === 'dailyDebt' || pay.targetType === 'legacyDirect') {
                subsequentDailyPaymentsSum = subsequentDailyPaymentsSum.plus(new client_1.Prisma.Decimal(pay.amount.toString()));
            }
        }
        const adjustments = await db.balanceAdjustment.findMany({
            where: { clientId },
        });
        let subsequentAdjustmentsSum = new client_1.Prisma.Decimal(0);
        for (const adj of adjustments) {
            if (adj.status !== 'ACTIVO')
                continue;
            const isPost = !hasSnapshot || (adj.createdAt !== null && new Date(adj.createdAt) > cutOffDate);
            if (!isPost)
                continue;
            if (adj.type === 'DAILY_PAYMENT_REVERSAL') {
                subsequentAdjustmentsSum = subsequentAdjustmentsSum.plus(new client_1.Prisma.Decimal(adj.amount.toString()));
            }
            else if (adj.type === 'DAILY_DEBT_REVERSAL') {
                subsequentAdjustmentsSum = subsequentAdjustmentsSum.minus(new client_1.Prisma.Decimal(adj.amount.toString()));
            }
            else if (adj.type === 'MIGRATION_ADJUSTMENT') {
                subsequentAdjustmentsSum = subsequentAdjustmentsSum.plus(new client_1.Prisma.Decimal(adj.amount.toString()));
            }
        }
        const dailyDebtBalanceDecimal = baseDailyDebt
            .plus(subsequentChargesSum)
            .minus(subsequentDailyPaymentsSum)
            .plus(subsequentAdjustmentsSum)
            .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const activeLoans = await db.loan.findMany({
            where: {
                clientId,
                status: { in: ['Activo', 'Vencido'] },
            },
        });
        let bankDebtBalanceDecimal = new client_1.Prisma.Decimal(0);
        for (const loan of activeLoans) {
            const pendingDec = new client_1.Prisma.Decimal(loan.pendingAmount.toString());
            bankDebtBalanceDecimal = bankDebtBalanceDecimal.plus(client_1.Prisma.Decimal.max(new client_1.Prisma.Decimal(0), pendingDec));
        }
        bankDebtBalanceDecimal = bankDebtBalanceDecimal.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const currentBalanceDecimal = dailyDebtBalanceDecimal
            .plus(bankDebtBalanceDecimal)
            .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const creditExposureDecimal = client_1.Prisma.Decimal.max(new client_1.Prisma.Decimal(0), dailyDebtBalanceDecimal)
            .plus(bankDebtBalanceDecimal)
            .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const creditLimitDecimal = new client_1.Prisma.Decimal((client.creditLimit != null ? client.creditLimit : 0).toString()).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const availableCredit = creditLimitDecimal.greaterThan(new client_1.Prisma.Decimal(0))
            ? client_1.Prisma.Decimal.max(new client_1.Prisma.Decimal(0), creditLimitDecimal.minus(creditExposureDecimal)).toNumber()
            : 'Sin límite';
        if (!dailyDebtBalanceDecimal.plus(bankDebtBalanceDecimal).equals(currentBalanceDecimal)) {
            throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: dailyDebt (${dailyDebtBalanceDecimal.toFixed(2)}) + bankDebt (${bankDebtBalanceDecimal.toFixed(2)}) != currentBalance (${currentBalanceDecimal.toFixed(2)})`);
        }
        if (bankDebtBalanceDecimal.lessThan(new client_1.Prisma.Decimal(0))) {
            throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: bankDebtBalance no puede ser negativo (${bankDebtBalanceDecimal.toFixed(2)})`);
        }
        if (creditExposureDecimal.lessThan(bankDebtBalanceDecimal)) {
            throw new common_1.BadRequestException(`BALANCE_LEDGER_INTEGRITY_ERROR: Violación de invariante: creditExposure (${creditExposureDecimal.toFixed(2)}) no puede ser menor a bankDebt (${bankDebtBalanceDecimal.toFixed(2)})`);
        }
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
};
exports.BalanceSyncService = BalanceSyncService;
exports.BalanceSyncService = BalanceSyncService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BalanceSyncService);
//# sourceMappingURL=balance-sync.service.js.map