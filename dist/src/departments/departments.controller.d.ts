import { DepartmentsService } from './departments.service';
export declare class DepartmentsController {
    private departmentsService;
    constructor(departmentsService: DepartmentsService);
    getDepartments(active?: string, q?: string): Promise<({
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
    getDepartmentById(id: string): Promise<{
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
    createDepartment(body: any): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    updateDepartment(id: string, body: any): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    deactivateDepartment(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    reactivateDepartment(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
    deleteDepartment(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        businessId: string;
    }>;
}
