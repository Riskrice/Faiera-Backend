import { Role } from '../../auth/constants/roles.constant';
import { UserStatus } from '../../auth/entities/user.entity';

export interface UserResponse {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: Role;
    status: UserStatus;
    grade?: string;
    preferredLanguage: string;
    lastLoginAt?: Date;
    emailVerifiedAt?: Date;
    parentId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface StudentWithParent extends UserResponse {
    parent?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
    };
}

export interface ParentWithStudents extends UserResponse {
    students: Array<{
        id: string;
        firstName: string;
        lastName: string;
        grade?: string;
    }>;
}
