import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RBAC_PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/require-permissions.decorator';
import { RbacService } from '../services/rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // استخراج الصلاحيات المطلوبة من الـ Decorator للـ Method أو Controller
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      RBAC_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      // إذا لم يكن هناك صلاحيات مطلوبة، نسمح بالمرور (Protected by JwtAuthGuard usually)
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // المرفق بواسطة JwtStrategy

    if (!user || (!user.id && !user.sub)) {
      throw new UnauthorizedException('المستخدم غير مسجل دخول');
    }

    const userId = user.id || user.sub;

    // فحص الصلاحيات للمدير عن طريق RbacService (التي يمكن أن تستخدم Redis للتسريع)
    const hasPermission = await this.rbacService.checkUserPermissions(userId, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException('عفواً، لا تملك الصلاحيات الكافية لتنفيذ هذا الإجراء.');
    }

    return true;
  }
}
