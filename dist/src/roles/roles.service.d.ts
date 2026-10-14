import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare const SYSTEM_PERMISSIONS: {
    code: string;
    name: string;
    module: string;
    description: string;
}[];
export declare const SYSTEM_CASH_PERMISSIONS: {
    code: string;
    name: string;
    module: string;
    description: string;
}[];
export declare class RolesService implements OnModuleInit {
    private prisma;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    ensureSystemPermissions(): Promise<void>;
    getRoles(): Promise<({
        permissions: ({
            permission: {
                id: string;
                name: string;
                createdAt: Date;
                code: string;
                module: string;
                description: string | null;
            };
        } & {
            id: string;
            roleId: string;
            createdAt: Date;
            permissionId: string;
        })[];
        _count: {
            users: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    })[]>;
    getRoleById(id: string): Promise<{
        permissions: ({
            permission: {
                id: string;
                name: string;
                createdAt: Date;
                code: string;
                module: string;
                description: string | null;
            };
        } & {
            id: string;
            roleId: string;
            createdAt: Date;
            permissionId: string;
        })[];
        _count: {
            users: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    }>;
    createRole(data: {
        name: string;
        description?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    }>;
    updateRolePermissions(roleId: string, permissionCodes: string[]): Promise<({
        permissions: ({
            permission: {
                id: string;
                name: string;
                createdAt: Date;
                code: string;
                module: string;
                description: string | null;
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
    }) | null>;
    getAllPermissions(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        code: string;
        module: string;
        description: string | null;
    }[]>;
}
