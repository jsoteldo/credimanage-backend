import { PrismaService } from '../prisma/prisma.service';
export declare class SuppliersService {
    private prisma;
    constructor(prisma: PrismaService);
    getSuppliers(query?: {
        active?: boolean | string;
        q?: string;
        businessId?: string;
    }): Promise<{
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
    getSupplierById(id: string, businessId?: string): Promise<{
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
    createSupplier(data: {
        name: string;
        taxId?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        contactName?: string | null;
        businessId?: string;
    }): Promise<{
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
    updateSupplier(id: string, data: {
        name?: string;
        taxId?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        contactName?: string | null;
        active?: boolean;
        businessId?: string;
    }): Promise<{
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
    deactivateSupplier(id: string, businessId?: string): Promise<{
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
    reactivateSupplier(id: string, businessId?: string): Promise<{
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
