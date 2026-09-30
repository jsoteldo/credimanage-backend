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
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let LocationsService = class LocationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getLocations(query) {
        const businessId = query?.businessId || 'default';
        const where = { businessId };
        if (query?.type) {
            where.type = query.type;
        }
        if (query?.active !== undefined && query?.active !== '') {
            where.active = query.active === true || query.active === 'true';
        }
        if (query?.q && query.q.trim()) {
            const q = query.q.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
            ];
        }
        return this.prisma.location.findMany({
            where,
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
        });
    }
    async getLocationById(id, businessId = 'default') {
        const location = await this.prisma.location.findFirst({
            where: { id, businessId },
        });
        if (!location) {
            throw new common_1.NotFoundException('Ubicación no encontrada');
        }
        return location;
    }
    async createLocation(data) {
        const businessId = data.businessId || 'default';
        const name = data.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre de la ubicación es obligatorio');
        }
        const code = data.code?.trim() || null;
        const existingName = await this.prisma.location.findFirst({
            where: { businessId, name: { equals: name, mode: 'insensitive' } },
        });
        if (existingName) {
            throw new common_1.BadRequestException(`Ya existe una ubicación con el nombre "${name}"`);
        }
        if (code) {
            const existingCode = await this.prisma.location.findFirst({
                where: { businessId, code: { equals: code, mode: 'insensitive' } },
            });
            if (existingCode) {
                throw new common_1.BadRequestException(`Ya existe una ubicación con el código "${code}"`);
            }
        }
        return this.prisma.location.create({
            data: {
                businessId,
                name,
                code,
                address: data.address?.trim() || null,
                type: data.type || client_1.LocationType.STORE,
                active: true,
            },
        });
    }
    async updateLocation(id, data) {
        const businessId = data.businessId || 'default';
        const existing = await this.getLocationById(id, businessId);
        const updateData = {};
        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) {
                throw new common_1.BadRequestException('El nombre de la ubicación no puede estar vacío');
            }
            if (name.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await this.prisma.location.findFirst({
                    where: {
                        businessId,
                        name: { equals: name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    throw new common_1.BadRequestException(`Ya existe otra ubicación con el nombre "${name}"`);
                }
            }
            updateData.name = name;
        }
        if (data.code !== undefined) {
            const code = data.code?.trim() || null;
            if (code &&
                (!existing.code || code.toLowerCase() !== existing.code.toLowerCase())) {
                const duplicate = await this.prisma.location.findFirst({
                    where: {
                        businessId,
                        code: { equals: code, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    throw new common_1.BadRequestException(`Ya existe otra ubicación con el código "${code}"`);
                }
            }
            updateData.code = code;
        }
        if (data.address !== undefined) {
            updateData.address = data.address?.trim() || null;
        }
        if (data.type !== undefined) {
            updateData.type = data.type;
        }
        if (data.active !== undefined) {
            updateData.active = Boolean(data.active);
        }
        return this.prisma.location.update({
            where: { id },
            data: updateData,
        });
    }
    async deactivateLocation(id, businessId = 'default') {
        await this.getLocationById(id, businessId);
        return this.prisma.location.update({
            where: { id },
            data: { active: false },
        });
    }
    async reactivateLocation(id, businessId = 'default') {
        await this.getLocationById(id, businessId);
        return this.prisma.location.update({
            where: { id },
            data: { active: true },
        });
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LocationsService);
//# sourceMappingURL=locations.service.js.map