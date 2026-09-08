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
exports.DepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DepartmentsService = class DepartmentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDepartments(query) {
        const businessId = query?.businessId || 'default';
        const where = { businessId };
        if (query?.active !== undefined && query?.active !== '') {
            where.active = query.active === true || query.active === 'true';
        }
        if (query?.q && query.q.trim()) {
            const q = query.q.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        return this.prisma.department.findMany({
            where,
            include: {
                _count: {
                    select: { products: true },
                },
            },
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
        });
    }
    async getDepartmentById(id, businessId = 'default') {
        const dept = await this.prisma.department.findFirst({
            where: { id, businessId },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });
        if (!dept) {
            throw new common_1.NotFoundException('Departamento no encontrado');
        }
        return dept;
    }
    async createDepartment(data) {
        const businessId = data.businessId || 'default';
        const name = data.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre del departamento es obligatorio');
        }
        const existing = await this.prisma.department.findFirst({
            where: {
                businessId,
                name: { equals: name, mode: 'insensitive' },
            },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Ya existe un departamento con el nombre "${name}"`);
        }
        return this.prisma.department.create({
            data: {
                businessId,
                name,
                description: data.description?.trim() || null,
                active: true,
            },
        });
    }
    async updateDepartment(id, data) {
        const businessId = data.businessId || 'default';
        const existing = await this.getDepartmentById(id, businessId);
        const updateData = {};
        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) {
                throw new common_1.BadRequestException('El nombre del departamento no puede estar vacío');
            }
            if (name.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await this.prisma.department.findFirst({
                    where: {
                        businessId,
                        name: { equals: name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    throw new common_1.BadRequestException(`Ya existe otro departamento con el nombre "${name}"`);
                }
            }
            updateData.name = name;
        }
        if (data.description !== undefined) {
            updateData.description = data.description?.trim() || null;
        }
        if (data.active !== undefined) {
            updateData.active = Boolean(data.active);
        }
        return this.prisma.department.update({
            where: { id },
            data: updateData,
        });
    }
    async deactivateDepartment(id, businessId = 'default') {
        await this.getDepartmentById(id, businessId);
        return this.prisma.department.update({
            where: { id },
            data: { active: false },
        });
    }
    async reactivateDepartment(id, businessId = 'default') {
        await this.getDepartmentById(id, businessId);
        return this.prisma.department.update({
            where: { id },
            data: { active: true },
        });
    }
    async deleteDepartment(id, businessId = 'default') {
        const dept = await this.getDepartmentById(id, businessId);
        if (dept._count.products > 0) {
            throw new common_1.BadRequestException(`No se puede eliminar el departamento "${dept.name}" porque tiene ${dept._count.products} producto(s) asociado(s). Se recomienda desactivarlo.`);
        }
        return this.prisma.department.delete({
            where: { id },
        });
    }
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map