export enum Role {
    STUDENT = 'student',
    TEACHER = 'teacher',
    PARENT = 'parent',

    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin',
}

export enum Permission {
    // Content permissions
    CONTENT_READ = 'content:read',
    CONTENT_WRITE = 'content:write',
    CONTENT_DELETE = 'content:delete',
    CONTENT_PUBLISH = 'content:publish',

    // User permissions
    USER_READ = 'user:read',
    USER_WRITE = 'user:write',
    USER_DELETE = 'user:delete',

    // Subscription permissions
    SUBSCRIPTION_READ = 'subscription:read',
    SUBSCRIPTION_WRITE = 'subscription:write',

    // Live session permissions
    SESSION_CREATE = 'session:create',
    SESSION_JOIN = 'session:join',
    SESSION_MANAGE = 'session:manage',

    // Assessment permissions
    ASSESSMENT_READ = 'assessment:read',
    ASSESSMENT_WRITE = 'assessment:write',
    ASSESSMENT_ATTEMPT = 'assessment:attempt',

    // Question bank permissions
    QUESTION_CONTRIBUTE = 'question:contribute',
    QUESTION_REVIEW = 'question:review',
    QUESTION_APPROVE = 'question:approve',

    // Payment permissions
    PAYMENT_READ = 'payment:read',
    PAYMENT_WRITE = 'payment:write',
    PAYMENT_REFUND = 'payment:refund',

    // Admin permissions
    ADMIN_DASHBOARD = 'admin:dashboard',
    ADMIN_ANALYTICS = 'admin:analytics',
    ADMIN_SETTINGS = 'admin:settings',
    ADMIN_AUDIT = 'admin:audit',
}

// Role to Permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.STUDENT]: [
        Permission.CONTENT_READ,
        Permission.SESSION_JOIN,
        Permission.ASSESSMENT_ATTEMPT,
        Permission.SUBSCRIPTION_READ,
        Permission.PAYMENT_READ,
    ],
    [Role.TEACHER]: [
        Permission.CONTENT_READ,
        Permission.SESSION_CREATE,
        Permission.SESSION_MANAGE,
        Permission.ASSESSMENT_READ,
        Permission.ASSESSMENT_WRITE,
        Permission.QUESTION_CONTRIBUTE,
        Permission.USER_READ,
    ],

    [Role.PARENT]: [
        Permission.USER_READ,
        Permission.PAYMENT_READ,
        Permission.SUBSCRIPTION_READ,
    ],

    [Role.ADMIN]: Object.values(Permission), // Full access — same as SUPER_ADMIN
    [Role.SUPER_ADMIN]: Object.values(Permission), // All permissions
};
