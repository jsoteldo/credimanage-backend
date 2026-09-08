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
        permissions: string[];
        roleEntity: ({
            permissions: ({
                permission: {
                    id: string;
                    name: string;
                    createdAt: Date;
                    description: string | null;
                    code: string;
                    module: string;
                };
            } & {
                id: string;
                roleId: string;
                createdAt: Date;
                permissionId: string;
            })[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            isSystem: boolean;
        }) | null;
        id: string;
        email: string;
        name: string;
        password: string;
        role: import("@prisma/client").$Enums.UserRole;
        roleId: string | null;
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
