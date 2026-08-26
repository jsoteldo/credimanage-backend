"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const bcrypt = __importStar(require("bcryptjs"));
let AdminService = class AdminService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async getUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'asc' },
        });
    }
    async createUser(data, adminUser) {
        const email = data.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existing) {
            throw new common_1.BadRequestException('Ya existe un usuario registrado con este correo');
        }
        const password = data.password ? data.password : '123456';
        const passwordHash = bcrypt.hashSync(password, 10);
        const newUser = await this.prisma.user.create({
            data: {
                name: data.name.trim(),
                email,
                password: passwordHash,
                role: (data.role || 'Generico'),
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
                active: data.active !== undefined ? Boolean(data.active) : true,
                approved: data.approved !== undefined ? Boolean(data.approved) : true,
            },
        });
        await this.auditService.logAudit(adminUser.id, adminUser.name, adminUser.role, 'CREAR_USUARIO', `Nuevo usuario de sistema creado: ${newUser.name} (${newUser.email}) con rol ${newUser.role}`, newUser.id);
        return newUser;
    }
    async approveUser(id, adminUser) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                approved: true,
                approvedBy: adminUser.name,
                approvedAt: new Date(),
            },
        });
        await this.auditService.logAudit(adminUser.id, adminUser.name, adminUser.role, 'APROBAR_USUARIO', `Usuario ${updated.name} aprobado por Administrador`, updated.id);
        return updated;
    }
    async enableUser(id, adminUser) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        const updated = await this.prisma.user.update({
            where: { id },
            data: { active: true },
        });
        await this.auditService.logAudit(adminUser.id, adminUser.name, adminUser.role, 'HABILITAR_USUARIO', `Usuario ${updated.name} habilitado por Administrador`, updated.id);
        return updated;
    }
    async disableUser(id, adminUser) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        const updated = await this.prisma.user.update({
            where: { id },
            data: { active: false },
        });
        await this.auditService.logAudit(adminUser.id, adminUser.name, adminUser.role, 'DESHABILITAR_USUARIO', `Usuario ${updated.name} deshabilitado por Administrador`, updated.id);
        return updated;
    }
    async updateUser(id, data, adminUser) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        const updateData = {};
        if (data.name)
            updateData.name = data.name.trim();
        if (data.email)
            updateData.email = data.email.trim().toLowerCase();
        if (data.role)
            updateData.role = data.role;
        if (data.active !== undefined)
            updateData.active = Boolean(data.active);
        if (data.approved !== undefined)
            updateData.approved = Boolean(data.approved);
        if (data.password) {
            updateData.password = bcrypt.hashSync(data.password, 10);
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: updateData,
        });
        await this.auditService.logAudit(adminUser.id, adminUser.name, adminUser.role, 'ACTUALIZAR_USUARIO', `Usuario ${updated.name} actualizado por Administrador`, updated.id);
        return updated;
    }
    async updateUserPermissions(id, updates, adminUser) {
        return this.updateUser(id, updates, adminUser);
    }
    async getAuditLogs() {
        return this.prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
        });
    }
    async getAnnulledOperations() {
        const annulledPurchases = await this.prisma.creditPurchase.findMany({
            where: { status: 'Anulado' },
            orderBy: { annulledAt: 'desc' },
        });
        const annulledPayments = await this.prisma.payment.findMany({
            where: { status: 'Anulado' },
            orderBy: { annulledAt: 'desc' },
        });
        return {
            annulledPurchases,
            annulledPayments,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AdminService);
//# sourceMappingURL=admin.service.js.map