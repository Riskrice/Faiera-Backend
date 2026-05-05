import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RbacService } from '../services/rbac.service';
import { CreateRoleDto, UpdateRoleDto } from '../dto/create-role.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminRoleDto } from '../dto/update-admin-role.dto';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { createPaginatedResponse, createSuccessResponse } from '../../../common/dto';
import { JwtPayload, Roles } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';

@UseGuards(PermissionsGuard)
@Controller('admin/rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('me')
  async getMyPermissions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      return createSuccessResponse({
        hasRbacAccess: false,
        isSuperAdmin: false,
        permissions: [],
        hasQuestionBankAccess: false,
        canManageQuestionBank: false,
      });
    }

    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const permissions = await this.rbacService.getUserPermissionKeys(userId);
    const hasAccess =
      isSuperAdmin &&
      (await this.rbacService.checkUserPermissions(userId, [
        { action: 'view', resource: 'admins' },
      ]));
    const hasQuestionBankAccess =
      permissions.includes('manage:all') ||
      permissions.includes('view:questions') ||
      permissions.includes('manage:questions');
    const canManageQuestionBank =
      permissions.includes('manage:all') || permissions.includes('manage:questions');

    return createSuccessResponse({
      hasRbacAccess: hasAccess,
      isSuperAdmin,
      permissions,
      hasQuestionBankAccess,
      canManageQuestionBank,
    });
  }

  @Get('roles')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'view', resource: 'roles' })
  async getRoles(@Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const roles = await this.rbacService.getAllRoles(actorId);
    return createSuccessResponse(roles);
  }

  @Get('permissions')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'view', resource: 'roles' })
  async getPermissions(@Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const permissions = await this.rbacService.getAllPermissions(actorId);
    return createSuccessResponse(permissions);
  }

  @Get('admins')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'view', resource: 'admins' })
  async getAdmins(@Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const admins = await this.rbacService.getAllAdminUsers(actorId);
    return createSuccessResponse(admins);
  }

  @Post('admins')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'admins' })
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const admin = await this.rbacService.createAdmin(actorId, dto, this.getAuditContext(req));
    return createSuccessResponse(admin, 'تم إنشاء مشرف جديد بنجاح');
  }

  @Patch('admins/:userId/role')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'admins' })
  async updateAdminRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateAdminRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = this.getActorId(req);
    const admin = await this.rbacService.updateAdminRole(
      actorId,
      userId,
      dto,
      this.getAuditContext(req),
    );
    return createSuccessResponse(admin, 'تم تحديث دور المشرف بنجاح');
  }

  @Delete('admins/:userId')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'admins' })
  async revokeAdmin(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = this.getActorId(req);
    const admin = await this.rbacService.revokeAdmin(actorId, userId, this.getAuditContext(req));
    return createSuccessResponse(admin, 'تم إلغاء صلاحيات المشرف بنجاح');
  }

  @Post('roles')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'roles' })
  async createRole(@Body() createRoleDto: CreateRoleDto, @Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const role = await this.rbacService.createRole(
      actorId,
      createRoleDto,
      this.getAuditContext(req),
    );
    return createSuccessResponse(role, 'تم إنشاء الدور بنجاح');
  }

  @Patch('roles/:roleId')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'roles' })
  async updateRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = this.getActorId(req);
    const role = await this.rbacService.updateRole(actorId, roleId, dto, this.getAuditContext(req));
    return createSuccessResponse(role, 'تم تحديث الدور بنجاح');
  }

  @Delete('roles/:roleId')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'roles' })
  async deleteRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const actorId = this.getActorId(req);
    await this.rbacService.deleteRole(actorId, roleId, this.getAuditContext(req));
    return createSuccessResponse(null, 'تم حذف الدور بنجاح');
  }

  @Get('audit')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'view', resource: 'audit' })
  async getAuditLogs(@Query() query: AuditQueryDto, @Req() req: AuthenticatedRequest) {
    const actorId = this.getActorId(req);
    const result = await this.rbacService.getAuditLogs(actorId, query);

    return createPaginatedResponse(result.logs, result.page, result.pageSize, result.total);
  }

  @Post('assign')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions({ action: 'manage', resource: 'admins' })
  async assignRole(@Body() assignRoleDto: AssignRoleDto, @Req() req: AuthenticatedRequest) {
    const assignerId = this.getActorId(req);
    const assignment = await this.rbacService.assignRoleToUser(
      assignRoleDto,
      assignerId,
      this.getAuditContext(req),
    );
    return createSuccessResponse(assignment, 'تم تعيين الدور للمشرف بنجاح');
  }

  private getActorId(req: AuthenticatedRequest): string {
    const actorId = req.user?.sub;
    if (!actorId) {
      throw new UnauthorizedException('المستخدم غير مسجل دخول');
    }

    return actorId;
  }

  private getAuditContext(req: AuthenticatedRequest): { ipAddress?: string; userAgent?: string } {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    const ipAddress = forwardedIp?.trim() || req.ip;
    const userAgent = req.headers['user-agent'];

    return {
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
    };
  }
}

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};
