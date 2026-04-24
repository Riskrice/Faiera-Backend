import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';
import { AdminRole } from '../entities/admin-role.entity';
import { Permission } from '../entities/permission.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { RequiredPermission } from '../decorators/require-permissions.decorator';
import { CreateRoleDto, UpdateRoleDto } from '../dto/create-role.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminRoleDto } from '../dto/update-admin-role.dto';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { runRbacSeeder } from '../rbac.seeder';
import { User, UserStatus } from '../../auth/entities/user.entity';
import { Role } from '../../auth/constants/roles.constant';
import { CacheService } from '../../../redis/cache.service';
import { QUEUE_NAMES } from '../../../queue/constants';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogsResult {
  logs: AdminAuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(AdminRole)
    private readonly adminRoleRepository: Repository<AdminRole>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue(QUEUE_NAMES.EMAILS)
    private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing RBAC default data...');
    try {
      await runRbacSeeder(this.dataSource);
    } catch (e) {
      this.logger.error('Failed to run RBAC seeder', e);
    }
  }

  async checkUserPermissions(userId: string, requiredPermissions: RequiredPermission[]): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userPermissionKeys = await this.getPermissionKeysForUser(userId);
    if (userPermissionKeys.length === 0) {
      return false;
    }

    if (userPermissionKeys.includes('manage:all')) {
        return true;
    }

    const permissionSet = new Set(userPermissionKeys);
    return requiredPermissions.every((required) => this.hasPermission(permissionSet, required));
  }

  async getAllRoles(actorId: string): Promise<AdminRole[]> {
    await this.assertActorIsSuperAdmin(actorId);
    return this.adminRoleRepository.find({
      relations: ['permissions'],
      order: { isSystem: 'DESC', name: 'ASC' },
    });
  }

  async getAllPermissions(actorId: string): Promise<Permission[]> {
    await this.assertActorIsSuperAdmin(actorId);
    return this.permissionRepository.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  async getAllAdminUsers(actorId: string): Promise<AdminUser[]> {
    await this.assertActorIsSuperAdmin(actorId);
    return this.adminUserRepository.find({
      where: { revokedAt: IsNull() },
      relations: ['user', 'role', 'role.permissions', 'assignedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRole(
    actorId: string,
    createRoleDto: CreateRoleDto,
    auditContext?: AuditContext,
  ): Promise<AdminRole> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const roleRepository = manager.getRepository(AdminRole);
      const normalizedName = createRoleDto.name.trim();

      const existingRole = await roleRepository
        .createQueryBuilder('role')
        .where('LOWER(role.name) = LOWER(:name)', { name: normalizedName })
        .getOne();

      if (existingRole) {
        throw new ConflictException('يوجد دور بنفس الاسم بالفعل');
      }

      const permissions = await this.resolvePermissions(createRoleDto.permissionIds, manager);

      const role = roleRepository.create({
        name: normalizedName,
        description: createRoleDto.description?.trim(),
        isSystem: false,
        permissions,
      });

      const savedRole = await roleRepository.save(role);

      await this.logAudit(
        {
          actorId,
          action: 'role.create',
          resource: 'roles',
          details: {
            roleId: savedRole.id,
            roleName: savedRole.name,
            permissionIds: permissions.map((permission) => permission.id),
          },
          ...auditContext,
        },
        manager,
      );

      const fullRole = await roleRepository.findOne({
        where: { id: savedRole.id },
        relations: ['permissions'],
      });

      if (!fullRole) {
        throw new NotFoundException('تعذر تحميل الدور بعد إنشائه');
      }

      return fullRole;
    });
  }

  async updateRole(
    actorId: string,
    roleId: string,
    dto: UpdateRoleDto,
    auditContext?: AuditContext,
  ): Promise<AdminRole> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const roleRepository = manager.getRepository(AdminRole);
      const role = await roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
      if (!role) {
        throw new NotFoundException('الدور المطلوب غير موجود');
      }

      if (role.isSystem || this.isSuperAdminRole(role)) {
        throw new ForbiddenException('لا يمكن تعديل دور نظام محمي');
      }

      const previousState = {
        name: role.name,
        description: role.description,
        permissionIds: role.permissions.map((permission) => permission.id),
      };

      if (dto.name !== undefined) {
        const normalizedName = dto.name.trim();
        const duplicateRole = await roleRepository
          .createQueryBuilder('candidate')
          .where('LOWER(candidate.name) = LOWER(:name)', { name: normalizedName })
          .andWhere('candidate.id != :id', { id: roleId })
          .getOne();

        if (duplicateRole) {
          throw new ConflictException('يوجد دور بنفس الاسم بالفعل');
        }

        role.name = normalizedName;
      }

      if (dto.description !== undefined) {
        role.description = dto.description?.trim() || undefined;
      }

      if (dto.permissionIds !== undefined) {
        role.permissions = await this.resolvePermissions(dto.permissionIds, manager);
      }

      const savedRole = await roleRepository.save(role);

      await this.invalidateRoleAssigneePermissionCache(savedRole.id, manager);

      await this.logAudit(
        {
          actorId,
          action: 'role.update',
          resource: 'roles',
          details: {
            roleId: savedRole.id,
            before: previousState,
            after: {
              name: savedRole.name,
              description: savedRole.description,
              permissionIds: savedRole.permissions.map((permission) => permission.id),
            },
          },
          ...auditContext,
        },
        manager,
      );

      const fullRole = await roleRepository.findOne({
        where: { id: savedRole.id },
        relations: ['permissions'],
      });

      if (!fullRole) {
        throw new NotFoundException('تعذر تحميل الدور بعد التحديث');
      }

      return fullRole;
    });
  }

  async deleteRole(actorId: string, roleId: string, auditContext?: AuditContext): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const roleRepository = manager.getRepository(AdminRole);
      const role = await roleRepository.findOne({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException('الدور المطلوب غير موجود');
      }

      if (role.isSystem || this.isSuperAdminRole(role)) {
        throw new ForbiddenException('لا يمكن حذف دور نظام محمي');
      }

      const roleAssignments = await manager.getRepository(AdminUser).count({
        where: { roleId },
      });

      if (roleAssignments > 0) {
        throw new ConflictException('لا يمكن حذف الدور لأنه مرتبط بمشرفين حاليين أو بسجل تاريخي للإدارة');
      }

      await roleRepository.remove(role);

      await this.logAudit(
        {
          actorId,
          action: 'role.delete',
          resource: 'roles',
          details: {
            roleId,
            roleName: role.name,
          },
          ...auditContext,
        },
        manager,
      );
    });
  }

  async createAdmin(
    actorId: string,
    dto: CreateAdminDto,
    auditContext?: AuditContext,
  ): Promise<AdminUser> {
    const { assignment, emailMeta } = await this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const userRepository = manager.getRepository(User);
      const adminUserRepository = manager.getRepository(AdminUser);
      const role = await this.resolveAssignableRole(dto.roleId, manager);

      const normalizedEmail = dto.email.toLowerCase().trim();
      const existingUser = await userRepository.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        throw new ConflictException('يوجد مستخدم بنفس البريد الإلكتروني بالفعل');
      }

      const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

      const newUser = userRepository.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: normalizedEmail,
        phone: dto.phone,
        password: hashedPassword,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        preferredLanguage: 'ar',
      });
      const savedUser = await userRepository.save(newUser);

      const assignment = adminUserRepository.create({
        userId: savedUser.id,
        roleId: role.id,
        assignedById: actorId,
      });

      await adminUserRepository.save(assignment);
      await this.invalidatePermissionCache(savedUser.id);

      await this.logAudit(
        {
          actorId,
          targetUserId: savedUser.id,
          action: 'admin.create',
          resource: 'admins',
          details: {
            roleId: role.id,
            email: savedUser.email,
          },
          ...auditContext,
        },
        manager,
      );

      const savedAssignment = await adminUserRepository.findOne({
        where: { userId: savedUser.id },
        relations: ['user', 'role', 'role.permissions', 'assignedBy'],
      });

      if (!savedAssignment) {
        throw new NotFoundException('تعذر تحميل المشرف بعد الإنشاء');
      }

      return {
        assignment: savedAssignment,
        emailMeta: {
          email: savedUser.email,
          firstName: savedUser.firstName,
          roleName: role.name,
        },
      };
    });

    try {
      await this.sendAdminInviteEmail(emailMeta);
    } catch (error: any) {
      this.logger.error(`Failed to queue admin invite email for ${emailMeta.email}`, error?.stack || error);
    }

    return assignment;
  }

  async updateAdminRole(
    actorId: string,
    userId: string,
    dto: UpdateAdminRoleDto,
    auditContext?: AuditContext,
  ): Promise<AdminUser> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const userRepository = manager.getRepository(User);
      const adminUserRepository = manager.getRepository(AdminUser);
      const role = await this.resolveAssignableRole(dto.roleId, manager);

      const targetUser = await userRepository.findOne({ where: { id: userId } });
      if (!targetUser) {
        throw new NotFoundException('المستخدم المطلوب غير موجود');
      }

      if (targetUser.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('لا يمكن تعديل حساب Super Admin عبر هذه الواجهة');
      }

      let assignment = await adminUserRepository.findOne({
        where: { userId },
        relations: ['role'],
      });

      const beforeRoleId = assignment?.roleId;
      const beforeRoleName = assignment?.role?.name;

      if (!assignment) {
        assignment = adminUserRepository.create({
          userId,
          roleId: role.id,
          role,
          assignedById: actorId,
          previousRole: this.isPrimaryUserRole(targetUser.role) ? targetUser.role : undefined,
        });
      } else {
        assignment.roleId = role.id;
        assignment.role = role;
        assignment.assignedById = actorId;
        assignment.revokedAt = undefined;
        assignment.revokedById = undefined;

        if (!assignment.previousRole && this.isPrimaryUserRole(targetUser.role)) {
          assignment.previousRole = targetUser.role;
        }
      }

      targetUser.role = Role.ADMIN;

      await userRepository.save(targetUser);
      const savedAssignment = await adminUserRepository.save(assignment);
      await this.invalidatePermissionCache(userId);

      await this.logAudit(
        {
          actorId,
          targetUserId: userId,
          action: beforeRoleId ? 'admin.role_update' : 'admin.assign',
          resource: 'admins',
          details: {
            beforeRoleId,
            beforeRoleName,
            afterRoleId: role.id,
            afterRoleName: role.name,
          },
          ...auditContext,
        },
        manager,
      );

      const fullAssignment = await adminUserRepository.findOne({
        where: { id: savedAssignment.id },
        relations: ['user', 'role', 'role.permissions', 'assignedBy'],
      });

      if (!fullAssignment) {
        throw new NotFoundException('تعذر تحميل بيانات المشرف بعد تعديل الدور');
      }

      return fullAssignment;
    });
  }

  async revokeAdmin(actorId: string, userId: string, auditContext?: AuditContext): Promise<AdminUser> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertActorIsSuperAdmin(actorId, manager);

      const userRepository = manager.getRepository(User);
      const adminUserRepository = manager.getRepository(AdminUser);

      const targetUser = await userRepository.findOne({ where: { id: userId } });
      if (!targetUser) {
        throw new NotFoundException('المستخدم المطلوب غير موجود');
      }

      if (targetUser.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('لا يمكن إلغاء صلاحيات Super Admin عبر هذه الواجهة');
      }

      const assignment = await adminUserRepository.findOne({
        where: { userId },
        relations: ['role'],
      });

      if (!assignment || assignment.revokedAt) {
        throw new NotFoundException('المستخدم ليس ضمن فريق الإدارة النشط');
      }

      const restoredRole =
        assignment.previousRole && this.isPrimaryUserRole(assignment.previousRole)
          ? assignment.previousRole
          : Role.STUDENT;

      assignment.revokedAt = new Date();
      assignment.revokedById = actorId;

      targetUser.role = restoredRole;

      await userRepository.save(targetUser);
      const savedAssignment = await adminUserRepository.save(assignment);
      await this.invalidatePermissionCache(userId);

      await this.logAudit(
        {
          actorId,
          targetUserId: userId,
          action: 'admin.revoke',
          resource: 'admins',
          details: {
            previousAdminRoleId: assignment.roleId,
            restoredUserRole: restoredRole,
          },
          ...auditContext,
        },
        manager,
      );

      const fullAssignment = await adminUserRepository.findOne({
        where: { id: savedAssignment.id },
        relations: ['user', 'role', 'role.permissions', 'assignedBy', 'revokedBy'],
      });

      if (!fullAssignment) {
        throw new NotFoundException('تعذر تحميل بيانات المشرف بعد إلغاء الصلاحيات');
      }

      return fullAssignment;
    });
  }

  async assignRoleToUser(
    assignRoleDto: AssignRoleDto,
    assignedById?: string,
    auditContext?: AuditContext,
  ): Promise<AdminUser> {
    const targetUserId = assignRoleDto.userId || assignRoleDto.adminId;
    if (!targetUserId) {
      throw new BadRequestException('معرف المستخدم مطلوب');
    }

    if (!assignedById) {
      throw new ForbiddenException('لا يمكن تعديل الصلاحيات بدون معرف منفذ العملية');
    }

    return this.updateAdminRole(
      assignedById,
      targetUserId,
      { roleId: assignRoleDto.roleId },
      auditContext,
    );
  }

  async getAuditLogs(actorId: string, query: AuditQueryDto): Promise<AuditLogsResult> {
    await this.assertActorIsSuperAdmin(actorId);

    const qb = this.adminAuditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .leftJoinAndSelect('audit.targetUser', 'targetUser')
      .orderBy('audit.createdAt', 'DESC');

    if (query.action) {
      qb.andWhere('audit.action ILIKE :action', { action: `%${query.action}%` });
    }

    if (query.resource) {
      qb.andWhere('audit.resource ILIKE :resource', { resource: `%${query.resource}%` });
    }

    if (query.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.targetUserId) {
      qb.andWhere('audit.targetUserId = :targetUserId', { targetUserId: query.targetUserId });
    }

    qb.skip(query.skip).take(query.take);

    const [logs, total] = await qb.getManyAndCount();

    return {
      logs,
      total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
  }

  private async getPermissionKeysForUser(userId: string): Promise<string[]> {
    const cachedPermissions = await this.cacheService.getPermissions(userId);
    if (cachedPermissions && cachedPermissions.length > 0) {
      const normalizedCachedPermissions = cachedPermissions.filter((permission) =>
        this.isRbacPermissionKey(permission),
      );

      if (normalizedCachedPermissions.length > 0) {
        return [...new Set(normalizedCachedPermissions)];
      }

      // Legacy auth cache stores resource:action permissions under the same key.
      // Clear it so RBAC can repopulate with action:resource entries.
      await this.invalidatePermissionCache(userId);
    }

    const assignment = await this.adminUserRepository.findOne({
      where: { userId, revokedAt: IsNull() },
      relations: ['role', 'role.permissions'],
    });

    if (!assignment || !assignment.role) {
      // Super admins retain full RBAC access even if no admin_users row exists yet.
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'role'],
      });

      if (user?.role === Role.SUPER_ADMIN) {
        const superAdminPermissions = ['manage:all'];
        await this.cacheService.setPermissions(userId, superAdminPermissions);
        return superAdminPermissions;
      }

      await this.invalidatePermissionCache(userId);
      return [];
    }

    const permissions = assignment.role.permissions || [];
    const permissionKeys = permissions.map((permission) => this.permissionKey(permission));

    if (this.isSuperAdminRole(assignment.role) && !permissionKeys.includes('manage:all')) {
      permissionKeys.push('manage:all');
    }

    await this.cacheService.setPermissions(userId, [...new Set(permissionKeys)]);
    return [...new Set(permissionKeys)];
  }

  private permissionKey(permission: Pick<Permission, 'action' | 'resource'>): string {
    return `${permission.action}:${permission.resource}`;
  }

  private isRbacPermissionKey(permission: string): boolean {
    if (permission === 'manage:all') {
      return true;
    }

    const [action] = permission.split(':');
    return ['view', 'manage', 'create', 'update', 'delete'].includes(action);
  }

  private hasPermission(permissionSet: Set<string>, required: RequiredPermission): boolean {
    if (permissionSet.has('manage:all')) {
      return true;
    }

    const exactPermission = `${required.action}:${required.resource}`;
    if (permissionSet.has(exactPermission)) {
      return true;
    }

    const wildcardResourcePermission = `manage:${required.resource}`;
    return permissionSet.has(wildcardResourcePermission);
  }

  private async assertActorIsSuperAdmin(actorId: string, manager?: EntityManager): Promise<User> {
    const userRepository = manager ? manager.getRepository(User) : this.userRepository;
    const actor = await userRepository.findOne({ where: { id: actorId } });

    if (!actor) {
      throw new NotFoundException('مستخدم التنفيذ غير موجود');
    }

    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('هذه العملية متاحة لـ Super Admin فقط');
    }

    return actor;
  }

  private async resolvePermissions(
    permissionIds: string[] | undefined,
    manager?: EntityManager,
  ): Promise<Permission[]> {
    if (!permissionIds || permissionIds.length === 0) {
      return [];
    }

    const repository = manager ? manager.getRepository(Permission) : this.permissionRepository;
    const uniqueIds = [...new Set(permissionIds)];
    const permissions = await repository.find({ where: { id: In(uniqueIds) } });

    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException('تم إرسال معرفات صلاحيات غير صحيحة');
    }

    return permissions;
  }

  private async resolveAssignableRole(roleId: string, manager?: EntityManager): Promise<AdminRole> {
    const repository = manager ? manager.getRepository(AdminRole) : this.adminRoleRepository;
    const role = await repository.findOne({ where: { id: roleId }, relations: ['permissions'] });

    if (!role) {
      throw new NotFoundException(`الدور بمعرف ${roleId} غير موجود`);
    }

    if (this.isSuperAdminRole(role)) {
      throw new ForbiddenException('لا يمكن تعيين دور Super Admin من خلال هذه الواجهة');
    }

    return role;
  }

  private isSuperAdminRole(role: Pick<AdminRole, 'name'>): boolean {
    return role.name.trim().toLowerCase() === 'super admin';
  }

  private isPrimaryUserRole(role: Role): boolean {
    return role === Role.STUDENT || role === Role.TEACHER || role === Role.PARENT;
  }

  private async invalidatePermissionCache(userId: string): Promise<void> {
    try {
      await this.cacheService.deletePermissions(userId);
    } catch (error) {
      this.logger.warn(`Failed to invalidate permission cache for user ${userId}`);
    }
  }

  private async invalidateRoleAssigneePermissionCache(
    roleId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager ? manager.getRepository(AdminUser) : this.adminUserRepository;
    const assignments = await repository.find({ where: { roleId, revokedAt: IsNull() } });

    await Promise.all(assignments.map((assignment) => this.invalidatePermissionCache(assignment.userId)));
  }

  private async sendAdminInviteEmail(payload: {
    email: string;
    firstName: string;
    roleName: string;
  }): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://faiera.com';
    const loginBaseUrl = frontendUrl.replace(/\/+$/, '');

    await this.emailQueue.add('admin-invite', {
      to: payload.email,
      subject: 'تمت إضافتك كمشرف على فايرا',
      template: 'admin-invite',
      context: {
        name: payload.firstName,
        roleName: payload.roleName,
        loginUrl: `${loginBaseUrl}/login`,
      },
    });
  }

  private async logAudit(
    payload: {
      actorId: string;
      action: string;
      resource: string;
      details?: Record<string, unknown>;
      targetUserId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager ? manager.getRepository(AdminAuditLog) : this.adminAuditLogRepository;

    const auditLog = repository.create({
      actorId: payload.actorId,
      targetUserId: payload.targetUserId,
      action: payload.action,
      resource: payload.resource,
      details: payload.details,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    });

    await repository.save(auditLog);
  }
}
