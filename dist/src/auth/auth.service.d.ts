import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    private auditService;
    constructor(prisma: PrismaService, jwtService: JwtService, auditService: AuditService);
    login(email: string, pass: string): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            avatar: string | null;
        };
    }>;
    register(data: any): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
        };
    }>;
}
