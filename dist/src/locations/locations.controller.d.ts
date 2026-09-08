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
        type: import("@prisma/client").$Enums.LocationType;
        businessId: string;
    }[]>;
    getLocationById(id: string): Promise<{
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
    createLocation(body: any): Promise<{
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
    updateLocation(id: string, body: any): Promise<{
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
    deactivateLocation(id: string): Promise<{
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
    reactivateLocation(id: string): Promise<{
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
