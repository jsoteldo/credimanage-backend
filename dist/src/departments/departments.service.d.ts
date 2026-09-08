import { PrismaService } from '../prisma/prisma.service';
export declare class DepartmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    getDepartments(query?: {
        active?: boolean | string;
        q?: string;
        businessId?: string;
    }): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    })[]>;
    getDepartmentById(id: string, businessId?: string): Promise<{
        _count: {
            products: number;
        };
    } & {
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    createDepartment(data: {
        name: string;
        description?: string | null;
        businessId?: string;
    }): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    updateDepartment(id: string, data: {
        name?: string;
        description?: string | null;
        active?: boolean;
        businessId?: string;
    }): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    deactivateDepartment(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    reactivateDepartment(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    deleteDepartment(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
}
