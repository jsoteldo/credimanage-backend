import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    logAudit(userId: string, userName: string, userRole: UserRole, action: string, details: string, targetId?: string, ip?: string): Promise<{
        id: string;
        timestamp: Date;
        userId: string;
        userName: string;
        userRole: string;
        action: string;
        details: string;
        targetId: string | null;
        ip: string | null;
    }>;
}
