import { SetMetadata } from '@nestjs/common';

export const RBAC_PERMISSIONS_KEY = 'rbac_permissions';

export interface RequiredPermission {
  action: string;
  resource: string;
}

/**
 * دالات ديكور متقدمة (Decorator) تحرس الـ Endpoints
 * تعتمد على فحص الصلاحية والمورد، مثلاً `update` على `users`
 * بمعايير شركات مثل (Stripe, GitHub) التي تعتمد Attribute-Based/Resource-Based
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(RBAC_PERMISSIONS_KEY, permissions);
