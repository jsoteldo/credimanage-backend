import { LocationsService } from './locations.service';
import { LocationType } from '@prisma/client';
export declare class LocationsController {
    private locationsService;
    constructor(locationsService: LocationsService);
    getLocations(type?: LocationType, active?: string, q?: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }[]>;
    getLocationById(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }>;
    createLocation(body: any): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }>;
    updateLocation(id: string, body: any): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }>;
    deactivateLocation(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }>;
    reactivateLocation(id: string): Promise<{
        id: string;
        name: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        address: string | null;
        businessId: string;
        type: import("@prisma/client").$Enums.LocationType;
    }>;
}
