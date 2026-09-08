import { PrismaService } from '../prisma/prisma.service';
import { LocationType } from '@prisma/client';
export declare class LocationsService {
    private prisma;
    constructor(prisma: PrismaService);
    getLocations(query?: {
        type?: LocationType;
        active?: boolean | string;
        q?: string;
        businessId?: string;
    }): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }[]>;
    getLocationById(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }>;
    createLocation(data: {
        name: string;
        code?: string | null;
        address?: string | null;
        type?: LocationType;
        businessId?: string;
    }): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }>;
    updateLocation(id: string, data: {
        name?: string;
        code?: string | null;
        address?: string | null;
        type?: LocationType;
        active?: boolean;
        businessId?: string;
    }): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }>;
    deactivateLocation(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }>;
    reactivateLocation(id: string, businessId?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }>;
}
