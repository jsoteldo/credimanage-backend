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
exports.RolesService = exports.SYSTEM_CASH_PERMISSIONS = exports.SYSTEM_PERMISSIONS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
exports.SYSTEM_PERMISSIONS = [
    {
        code: 'cash.open',
        name: 'Abrir turno',
        module: 'cash',
        description: 'Permite realizar la apertura de un turno de caja con fondo inicial.',
    },
    {
        code: 'cash.close',
        name: 'Cerrar turno',
        module: 'cash',
        description: 'Permite realizar el arqueo y cierre definitivo de turno de caja.',
    },
    {
        code: 'cash.cash_in',
        name: 'Registrar ingresos manuales',
        module: 'cash',
        description: 'Permite agregar efectivo manualmente a una caja abierta.',
    },
    {
        code: 'cash.cash_out',
        name: 'Registrar retiros / egresos',
        module: 'cash',
        description: 'Permite retirar efectivo manualmente de una caja abierta.',
    },
    {
        code: 'cash.view',
        name: 'Consultar historial de caja',
        module: 'cash',
        description: 'Permite consultar el historial de turnos, arqueos y movimientos de caja.',
    },
    {
        code: 'cash.manage',
        name: 'Gestionar cajas registradoras',
        module: 'cash',
        description: 'Permite crear, editar, activar y desactivar cajas registradoras.',
    },
    {
        code: 'sales.view',
        name: 'Consultar ventas',
        module: 'sales',
        description: 'Permite visualizar el historial de ventas y comprobantes emitidos.',
    },
    {
        code: 'sales.create',
        name: 'Registrar ventas en POS',
        module: 'sales',
        description: 'Permite crear y cobrar ventas al contado, crédito o métodos digitales.',
    },
    {
        code: 'sales.annul',
        name: 'Anular ventas',
        module: 'sales',
        description: 'Permite anular ventas emitidas y revertir sus efectos.',
    },
    {
        code: 'inventory.view',
        name: 'Consultar inventario',
        module: 'inventory',
        description: 'Permite ver los niveles de stock actual por tienda o almacén.',
    },
    {
        code: 'inventory.entry',
        name: 'Registrar entrada de mercancía',
        module: 'inventory',
        description: 'Permite registrar compras o ingresos manuales de existencias.',
    },
    {
        code: 'inventory.adjust',
        name: 'Ajustar existencias',
        module: 'inventory',
        description: 'Permite realizar ajustes de inventario por merma o corrección.',
    },
    {
        code: 'inventory.transfer',
        name: 'Transferir entre almacenes',
        module: 'inventory',
        description: 'Permite trasladar productos entre sedes o almacenes.',
    },
    {
        code: 'inventory.min_stock',
        name: 'Configurar stock mínimo',
        module: 'inventory',
        description: 'Permite modificar alertas de existencias mínimas por producto.',
    },
    {
        code: 'product.view',
        name: 'Ver catálogo de productos',
        module: 'catalog',
        description: 'Permite buscar y visualizar los productos registrados.',
    },
    {
        code: 'product.create',
        name: 'Crear productos',
        module: 'catalog',
        description: 'Permite registrar nuevos productos en el catálogo maestro.',
    },
    {
        code: 'product.edit',
        name: 'Editar productos',
        module: 'catalog',
        description: 'Permite modificar precios, descripciones y datos del producto.',
    },
    {
        code: 'product.deactivate',
        name: 'Desactivar productos',
        module: 'catalog',
        description: 'Permite inhabilitar productos para venta.',
    },
    {
        code: 'department.manage',
        name: 'Gestionar categorías',
        module: 'catalog',
        description: 'Permite crear y editar categorías de productos.',
    },
    {
        code: 'supplier.manage',
        name: 'Gestionar proveedores',
        module: 'catalog',
        description: 'Permite registrar y administrar datos de proveedores.',
    },
    {
        code: 'location.manage',
        name: 'Gestionar tiendas y almacenes',
        module: 'admin',
        description: 'Permite crear y configurar sedes, tiendas y almacenes físicos.',
    },
];
exports.SYSTEM_CASH_PERMISSIONS = exports.SYSTEM_PERMISSIONS.filter((p) => p.module === 'cash');
let RolesService = class RolesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        try {
            await this.ensureSystemPermissions();
        }
        catch (err) {
            console.warn('[RolesService] Could not ensure system permissions on init:', err);
        }
    }
    async ensureSystemPermissions() {
        for (const p of exports.SYSTEM_PERMISSIONS) {
            await this.prisma.permission.upsert({
                where: { code: p.code },
                update: {
                    name: p.name,
                    module: p.module,
                    description: p.description,
                },
                create: {
                    code: p.code,
                    name: p.name,
                    module: p.module,
                    description: p.description,
                },
            });
        }
        const adminRole = await this.prisma.role.findUnique({
            where: { name: 'Administrador' },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });
        if (adminRole) {
            const existingCodes = adminRole.permissions.map((rp) => rp.permission.code);
            const allPerms = await this.prisma.permission.findMany();
            const missingAdmin = allPerms.filter((p) => !existingCodes.includes(p.code));
            if (missingAdmin.length > 0) {
                await this.prisma.rolePermission.createMany({
                    data: missingAdmin.map((p) => ({
                        roleId: adminRole.id,
                        permissionId: p.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
        const cajeroRole = await this.prisma.role.findUnique({
            where: { name: 'Cajero' },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });
        if (cajeroRole) {
            const existingCodes = cajeroRole.permissions.map((rp) => rp.permission.code);
            const safePerms = await this.prisma.permission.findMany({
                where: {
                    code: {
                        in: [
                            'cash.open',
                            'cash.close',
                            'cash.view',
                            'sales.view',
                            'sales.create',
                            'inventory.view',
                            'product.view',
                        ],
                    },
                },
            });
            const missingSafe = safePerms.filter((p) => !existingCodes.includes(p.code));
            if (missingSafe.length > 0) {
                await this.prisma.rolePermission.createMany({
                    data: missingSafe.map((p) => ({
                        roleId: cajeroRole.id,
                        permissionId: p.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }
    async getRoles() {
        await this.ensureSystemPermissions().catch(() => { });
        return this.prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { users: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async getRoleById(id) {
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { users: true },
                },
            },
        });
        if (!role) {
            throw new common_1.NotFoundException('Rol no encontrado');
        }
        return role;
    }
    async createRole(data) {
        const name = data.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre del rol es obligatorio');
        }
        const existing = await this.prisma.role.findUnique({
            where: { name },
        });
        if (existing) {
            throw new common_1.BadRequestException(`El rol "${name}" ya existe`);
        }
        return this.prisma.role.create({
            data: {
                name,
                description: data.description?.trim() || null,
                isSystem: false,
            },
        });
    }
    async updateRolePermissions(roleId, permissionCodes) {
        await this.getRoleById(roleId);
        const permissions = await this.prisma.permission.findMany({
            where: {
                code: { in: permissionCodes },
            },
        });
        return this.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({
                where: { roleId },
            });
            if (permissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissions.map((p) => ({
                        roleId,
                        permissionId: p.id,
                    })),
                });
            }
            return tx.role.findUnique({
                where: { id: roleId },
                include: {
                    permissions: {
                        include: { permission: true },
                    },
                },
            });
        });
    }
    async getAllPermissions() {
        await this.ensureSystemPermissions().catch(() => { });
        return this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { code: 'asc' }],
        });
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RolesService);
//# sourceMappingURL=roles.service.js.map