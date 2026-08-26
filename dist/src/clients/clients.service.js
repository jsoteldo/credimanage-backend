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
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let ClientsService = class ClientsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    mapPeriodFromDb(period) {
        if (period === 'DiaFijo')
            return 'Día Fijo';
        return period;
    }
    mapPeriodToDb(period) {
        if (period === 'Día Fijo')
            return 'DiaFijo';
        if (period === 'Semanal')
            return 'Semanal';
        if (period === 'Quincenal')
            return 'Quincenal';
        return 'Mensual';
    }
    mapClient(c) {
        if (!c)
            return null;
        return {
            ...c,
            paymentPeriod: this.mapPeriodFromDb(c.paymentPeriod),
        };
    }
    async getClients(searchQuery = '', status = 'todos') {
        const where = {};
        if (status && status !== 'todos') {
            if (status === 'con_deuda') {
                where.status = 'Activo';
                where.currentBalance = { gt: 0 };
            }
            else if (status === 'al_dia') {
                where.status = 'Activo';
                where.currentBalance = { lte: 0 };
            }
            else if (status === 'desactivados' || status === 'Desactivado') {
                where.status = 'Desactivado';
            }
            else if (status === 'activos' || status === 'Activo') {
                where.status = 'Activo';
            }
            else {
                where.status = status;
            }
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { clientNumber: { contains: q, mode: 'insensitive' } },
            ];
        }
        const list = await this.prisma.client.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return list.map((c) => this.mapClient(c));
    }
    async createClient(data, user) {
        let clientNumber = data.clientNumber ? data.clientNumber.trim() : null;
        if (!clientNumber) {
            const count = await this.prisma.client.count();
            clientNumber = `CLI-${1040 + count + Math.floor(Math.random() * 90)}`;
        }
        const newClient = await this.prisma.client.create({
            data: {
                clientNumber,
                name: data.name.trim(),
                phone: data.phone ? data.phone.trim() : '',
                address: data.address ? data.address.trim() : '',
                creditLimit: data.creditLimit !== undefined ? parseFloat(data.creditLimit) : 0,
                currentBalance: 0,
                paymentPeriod: this.mapPeriodToDb(data.paymentPeriod),
                paymentDay: data.paymentDay ? data.paymentDay.trim() : '',
                nextDueDate: data.nextDueDate ? data.nextDueDate.trim() : '',
                status: 'Activo',
            },
        });
        await this.auditService.logAudit(user.id, user.name, user.role, 'CREAR_CLIENTE', `Nuevo cliente registrado: ${newClient.name} (${newClient.clientNumber}) - Periodo: ${data.paymentPeriod || 'Mensual'} - Límite S/ ${newClient.creditLimit.toFixed(2)}`, newClient.id);
        return this.mapClient(newClient);
    }
    async updateClient(id, data, user) {
        const existing = await this.prisma.client.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        const updated = await this.prisma.client.update({
            where: { id },
            data: {
                name: data.name !== undefined ? data.name.trim() : existing.name,
                phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
                address: data.address !== undefined ? data.address.trim() : existing.address,
                creditLimit: data.creditLimit !== undefined ? parseFloat(data.creditLimit) : existing.creditLimit,
                paymentPeriod: data.paymentPeriod !== undefined ? this.mapPeriodToDb(data.paymentPeriod) : existing.paymentPeriod,
                paymentDay: data.paymentDay !== undefined ? data.paymentDay.trim() : existing.paymentDay,
                nextDueDate: data.nextDueDate !== undefined ? data.nextDueDate.trim() : existing.nextDueDate,
            },
        });
        await this.auditService.logAudit(user.id, user.name, user.role, 'MODIFICACION_CLIENTE', `Datos de cliente modificados: ${updated.name} (${updated.clientNumber}). Periodo: ${data.paymentPeriod || this.mapPeriodFromDb(updated.paymentPeriod)}, Cobro: ${updated.nextDueDate || 'Sin fecha'}.`, updated.id);
        return this.mapClient(updated);
    }
    async deactivateClient(id, user) {
        const client = await this.prisma.client.findUnique({ where: { id } });
        if (!client) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        if (Math.abs(client.currentBalance) > 0.01) {
            if (client.currentBalance > 0) {
                throw new common_1.BadRequestException(`No se puede desactivar el cliente porque tiene un saldo pendiente de S/ ${client.currentBalance.toFixed(2)}. Debe saldar la cuenta a S/ 0.00.`);
            }
            else {
                throw new common_1.BadRequestException(`No se puede desactivar el cliente porque tiene un saldo a favor de S/ ${Math.abs(client.currentBalance).toFixed(2)}. Debe saldar la cuenta a S/ 0.00.`);
            }
        }
        const updated = await this.prisma.client.update({
            where: { id },
            data: { status: 'Desactivado' },
        });
        await this.auditService.logAudit(user.id, user.name, user.role, 'DESACTIVAR_CLIENTE', `Cliente desactivado: ${updated.name} (${updated.clientNumber}). Traceabilidad histórica conservada.`, updated.id);
        return {
            message: 'Cliente desactivado con éxito',
            client: this.mapClient(updated),
        };
    }
    async reactivateClient(id, user) {
        const client = await this.prisma.client.findUnique({ where: { id } });
        if (!client) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        const updated = await this.prisma.client.update({
            where: { id },
            data: { status: 'Activo' },
        });
        await this.auditService.logAudit(user.id, user.name, user.role, 'REACTIVAR_CLIENTE', `Cliente reactivado: ${updated.name} (${updated.clientNumber}).`, updated.id);
        return {
            message: 'Cliente reactivado con éxito',
            client: this.mapClient(updated),
        };
    }
    async deleteClient(id, user) {
        const client = await this.prisma.client.findUnique({ where: { id } });
        if (!client) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        if (Math.abs(client.currentBalance) > 0.01) {
            if (client.currentBalance > 0) {
                throw new common_1.BadRequestException(`Regla de Negocio: No es posible eliminar un cliente con saldo pendiente (S/ ${client.currentBalance.toFixed(2)}). El saldo debe ser exactamente S/ 0.00.`);
            }
            else {
                throw new common_1.BadRequestException(`Regla de Negocio: No es posible eliminar un cliente con saldo a favor (S/ ${Math.abs(client.currentBalance).toFixed(2)}). El saldo debe ser exactamente S/ 0.00.`);
            }
        }
        const purchasesCount = await this.prisma.creditPurchase.count({ where: { clientId: id } });
        const paymentsCount = await this.prisma.payment.count({ where: { clientId: id } });
        const loansCount = await this.prisma.loan.count({ where: { clientId: id } });
        if (purchasesCount > 0 || paymentsCount > 0 || loansCount > 0) {
            throw new common_1.BadRequestException({
                error: `Regla de Auditoría: El cliente posee compras, abonos o créditos en su historial. Por trazabilidad legal y financiera no se permite borrado físico. Se recomienda la opción "Desactivar Cliente".`,
                suggestDeactivation: true,
            });
        }
        await this.prisma.client.delete({ where: { id } });
        await this.auditService.logAudit(user.id, user.name, user.role, 'ELIMINAR_CLIENTE_FISICO', `Eliminación física realizada para el cliente sin historial: ${client.name} (${client.clientNumber})`, id);
        return { message: 'Cliente eliminado físicamente con éxito' };
    }
    async getStatement(id) {
        const client = await this.prisma.client.findUnique({ where: { id } });
        if (!client) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        const purchases = await this.prisma.creditPurchase.findMany({
            where: { clientId: id },
            orderBy: { date: 'desc' },
        });
        const payments = await this.prisma.payment.findMany({
            where: { clientId: id },
            orderBy: { date: 'desc' },
        });
        const loans = await this.prisma.loan.findMany({
            where: { clientId: id },
            include: { installments: { orderBy: { installmentNumber: 'asc' } } },
            orderBy: { date: 'desc' },
        });
        const availableCredit = client.creditLimit > 0 ? client.creditLimit - client.currentBalance : 0;
        return {
            client: this.mapClient(client),
            availableCredit: client.creditLimit > 0 ? Math.max(0, availableCredit) : 'Sin límite',
            purchases,
            payments,
            loans: loans.map((loan) => ({
                ...loan,
                frequency: loan.frequency === 'DiaFijo' ? 'Día Fijo' : loan.frequency,
            })),
        };
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ClientsService);
//# sourceMappingURL=clients.service.js.map