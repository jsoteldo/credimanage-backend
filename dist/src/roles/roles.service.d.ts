import { PrismaService } from '../prisma/prisma.service';
export declare class RolesService {
    private prisma;
    constructor(prisma: PrismaService);
    getRoles(): Promise<({
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
    }) | null>;
    getAllPermissions(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        description: string | null;
        code: string;
        module: string;
    }[]>;
}
