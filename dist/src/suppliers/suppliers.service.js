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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SuppliersService = class SuppliersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSuppliers(query) {
        const businessId = query?.businessId || 'default';
        const where = { businessId };
        if (query?.active !== undefined && query?.active !== '') {
            where.active = query.active === true || query.active === 'true';
        }
        if (query?.q && query.q.trim()) {
            const q = query.q.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { taxId: { contains: q, mode: 'insensitive' } },
                { contactName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
            ];
        }
        return this.prisma.supplier.findMany({
            where,
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
        });
    }
    async getSupplierById(id, businessId = 'default') {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, businessId },
        });
        if (!supplier) {
            throw new common_1.NotFoundException('Proveedor no encontrado');
        }
        return supplier;
    }
    async createSupplier(data) {
        const businessId = data.businessId || 'default';
        const name = data.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre del proveedor es obligatorio');
        }
        const existing = await this.prisma.supplier.findFirst({
            where: { businessId, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Ya existe un proveedor con el nombre "${name}"`);
        }
        return this.prisma.supplier.create({
            data: {
                businessId,
                name,
                taxId: data.taxId?.trim() || null,
                phone: data.phone?.trim() || null,
                email: data.email?.trim() || null,
                address: data.address?.trim() || null,
                contactName: data.contactName?.trim() || null,
                active: true,
            },
        });
    }
    async updateSupplier(id, data) {
        const businessId = data.businessId || 'default';
        const existing = await this.getSupplierById(id, businessId);
        const updateData = {};
        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) {
                throw new common_1.BadRequestException('El nombre del proveedor no puede estar vacío');
            }
            if (name.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await this.prisma.supplier.findFirst({
                    where: {
                        businessId,
                        name: { equals: name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    throw new common_1.BadRequestException(`Ya existe otro proveedor con el nombre "${name}"`);
                }
            }
            updateData.name = name;
        }
        if (data.taxId !== undefined) {
            updateData.taxId = data.taxId?.trim() || null;
        }
        if (data.phone !== undefined) {
            updateData.phone = data.phone?.trim() || null;
        }
        if (data.email !== undefined) {
            updateData.email = data.email?.trim() || null;
        }
        if (data.address !== undefined) {
            updateData.address = data.address?.trim() || null;
        }
        if (data.contactName !== undefined) {
            updateData.contactName = data.contactName?.trim() || null;
        }
        if (data.active !== undefined) {
            updateData.active = Boolean(data.active);
        }
        return this.prisma.supplier.update({
            where: { id },
            data: updateData,
        });
    }
    async deactivateSupplier(id, businessId = 'default') {
        await this.getSupplierById(id, businessId);
        return this.prisma.supplier.update({
            where: { id },
            data: { active: false },
        });
    }
    async reactivateSupplier(id, businessId = 'default') {
        await this.getSupplierById(id, businessId);
        return this.prisma.supplier.update({
            where: { id },
            data: { active: true },
        });
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map