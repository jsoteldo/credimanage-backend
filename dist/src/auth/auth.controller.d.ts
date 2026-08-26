import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(body: any): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            avatar: string | null;
        };
    }>;
    register(body: any): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
        };
    }>;
    getMe(req: any): Promise<{
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            avatar: any;
            active: any;
            approved: any;
            createdAt: any;
        };
    }>;
}
