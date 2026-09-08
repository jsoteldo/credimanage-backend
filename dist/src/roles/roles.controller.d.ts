import { RolesService } from './roles.service';
export declare class RolesController {
    private rolesService;
    constructor(rolesService: RolesService);
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
    createRole(body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystem: boolean;
    }>;
    updateRolePermissions(id: string, permissions: string[]): Promise<({
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
