export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    timestamp: string;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    timestamp: string;
}

export interface PaginatedResponse<T> {
    success: true;
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    timestamp: string;
}

export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
        success: true,
        data,
        message,
        timestamp: new Date().toISOString(),
    };
}

export function createErrorResponse(
    code: string,
    message: string,
    details?: Record<string, unknown>,
): ApiErrorResponse {
    return {
        success: false,
        error: { code, message, details },
        timestamp: new Date().toISOString(),
    };
}

export function createPaginatedResponse<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
): PaginatedResponse<T> {
    return {
        success: true,
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
        timestamp: new Date().toISOString(),
    };
}
