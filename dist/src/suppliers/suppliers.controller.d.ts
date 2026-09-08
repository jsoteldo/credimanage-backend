import { SuppliersService } from './suppliers.service';
export declare class SuppliersController {
    private suppliersService;
    constructor(suppliersService: SuppliersService);
    getSuppliers(active?: string, q?: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }[]>;
    getSupplierById(id: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }>;
    createSupplier(body: any): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }>;
    updateSupplier(id: string, body: any): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }>;
    deactivateSupplier(id: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }>;
    reactivateSupplier(id: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        businessId: string;
        contactName: string | null;
        taxId: string | null;
    }>;
}
