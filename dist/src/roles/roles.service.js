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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RolesService = class RolesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getRoles() {
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
        const role = await this.getRoleById(roleId);
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