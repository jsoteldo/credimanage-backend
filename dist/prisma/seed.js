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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const bcrypt = __importStar(require("bcryptjs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Checking and seeding structural users...');
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    const cajeroPasswordHash = bcrypt.hashSync('cajero123', 10);
    await prisma.user.upsert({
        where: { email: 'admin@credimanage.pos' },
        update: {},
        create: {
            id: 'usr-1',
            name: 'Carlos Mendoza',
            email: 'admin@credimanage.pos',
            password: adminPasswordHash,
            role: 'Administrador',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
            active: true,
            approved: true,
            createdAt: new Date('2026-01-01T08:00:00Z'),
        },
    });
    await prisma.user.upsert({
        where: { email: 'cajero@credimanage.pos' },
        update: {},
        create: {
            id: 'usr-2',
            name: 'Sofía Castro (Cajera)',
            email: 'cajero@credimanage.pos',
            password: cajeroPasswordHash,
            role: 'Cajero',
            avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150',
            active: true,
            approved: true,
            createdAt: new Date('2026-01-15T09:30:00Z'),
        },
    });
    console.log('Database structural seeding checked/completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await pool.end();
});
//# sourceMappingURL=seed.js.map