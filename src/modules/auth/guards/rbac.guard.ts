import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, Permission, ROLE_PERMISSIONS } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../dto';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check roles
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Check permissions
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles or permissions required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    this.logger.debug(`Checking RBAC for user: ${user?.email} (${user?.role})`);
    this.logger.debug(
      `Required Roles: ${requiredRoles}, Required Permissions: ${requiredPermissions}`,
    );

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role privileges');
      }
    }

    // Check permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = ROLE_PERMISSIONS[user.role] || [];
      const hasAllPermissions = requiredPermissions.every(permission =>
        userPermissions.includes(permission),
      );
      if (!hasAllPermissions) {
        this.logger.warn(
          `User ${user.email} lacks permissions. Has: ${userPermissions}, Needs: ${requiredPermissions}`,
        );
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
