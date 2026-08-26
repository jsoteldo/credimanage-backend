import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private prisma;
    constructor(configService: ConfigService, prisma: PrismaService);
    validate(payload: any): Promise<{
        id: string;
        email: string;
        name: string;
        password: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatar: string | null;
        active: boolean;
        approved: boolean;
        approvedBy: string | null;
        approvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
