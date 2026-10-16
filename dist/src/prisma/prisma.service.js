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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const config_1 = require("@nestjs/config");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    pool;
    constructor(configService) {
        let rawConnectionString = configService.get('DATABASE_URL') || process.env.DATABASE_URL || '';
        const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');
        const sanitizedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
        console.log(`📡 [PrismaService] Conectando a base de datos: ${sanitizedUrl || 'VACÍA/NO DEFINIDA'}`);
        if (connectionString.includes('/neondb')) {
            console.warn('⚠️ [PrismaService] ADVERTENCIA CRÍTICA: DATABASE_URL apunta a la base de datos por defecto "/neondb" en vez de "/credimanage". Las tablas y datos del proyecto residen en "/credimanage".');
        }
        const pool = new pg_1.Pool({ connectionString });
        const adapter = new adapter_pg_1.PrismaPg(pool);
        super({ adapter });
        this.pool = pool;
    }
    async onModuleInit() {
        try {
            await this.$connect();
            console.log('✅ [PrismaService] Conexión establecida con la base de datos exitosamente.');
        }
        catch (err) {
            console.error('🔥 [PrismaService] Error al conectar con la base de datos:', err.message);
            throw err;
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map