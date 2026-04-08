import { Role, Permission } from '../constants/roles.constant';

export interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    status?: string;
    phone?: string;
    preferredLanguage: string;
    metadata?: Record<string, unknown>;
}

export interface JwtPayload {
    sub: string; // User ID
    email: string;
    role: Role;
    permissions: Permission[];
    iat?: number;
    exp?: number;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}

export interface AuthResponse {
    user: AuthUser;
    tokens: TokenResponse;
}

export interface RegisterResponse {
    user: AuthUser;
    requiresOtp: boolean;
}
