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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReportsService = class ReportsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBalanceReport(filter = 'Todos', query = '') {
        const where = {};
        if (query) {
            const q = query.toLowerCase().trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { clientNumber: { contains: q, mode: 'insensitive' } },
            ];
        }
        const normFilter = filter.toLowerCase().trim();
        if (normFilter === 'con deuda') {
            where.currentBalance = { gt: 0 };
        }
        else if (normFilter === 'sin deuda' || normFilter === 'pagado') {
            where.currentBalance = { lte: 0 };
        }
        else if (normFilter === 'saldo a favor') {
            where.currentBalance = { lt: 0 };
        }
        let list = await this.prisma.client.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        list = list.map((c) => ({
            ...c,
            paymentPeriod: c.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : c.paymentPeriod,
        }));
        if (normFilter === 'al límite') {
            list = list.filter((c) => c.creditLimit > 0 && c.currentBalance >= c.creditLimit * 0.9 && c.currentBalance > 0);
        }
        const allClients = await this.prisma.client.findMany();
        const clientsWithDebt = allClients.filter((c) => c.currentBalance > 0);
        const totalClientsDebt = clientsWithDebt.length;
        const totalPortfolioAmount = clientsWithDebt.reduce((sum, c) => sum + c.currentBalance, 0);
        return {
            report: list,
            summary: {
                totalClientsDebt,
                totalPortfolioAmount,
            },
        };
    }
    async getDashboardKPIs() {
        const totalClients = await this.prisma.client.count();
        const activeClients = await this.prisma.client.findMany({
            where: { status: 'Activo' },
        });
        const clientsWithDebt = activeClients.filter((c) => c.currentBalance > 0).length;
        const totalPendingDebt = activeClients
            .filter((c) => c.currentBalance > 0)
            .reduce((sum, c) => sum + c.currentBalance, 0);
        const clientsWithBalanceInFavor = activeClients.filter((c) => c.currentBalance < 0).length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const todayPayments = await this.prisma.payment.findMany({
            where: {
                status: 'Activo',
                date: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });
        const todayPaymentsTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);
        const clientsAtLimit = activeClients.filter((c) => c.creditLimit > 0 && c.currentBalance >= c.creditLimit * 0.9 && c.currentBalance > 0);
        const clientsAtLimitCount = clientsAtLimit.length;
        const clientsAtLimitNames = clientsAtLimit.map((c) => c.name);
        return {
            totalClients,
            clientsWithDebt,
            totalPendingDebt,
            clientsWithBalanceInFavor,
            todayPaymentsTotal,
            todayPaymentsCount: todayPayments.length,
            clientsAtLimitCount,
            clientsAtLimitNames,
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map