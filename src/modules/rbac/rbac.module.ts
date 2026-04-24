import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './services/rbac.service';
import { RbacController } from './controllers/rbac.controller';
import { AdminRole } from './entities/admin-role.entity';
import { AdminUser } from './entities/admin-user.entity';
import { Permission } from './entities/permission.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { PermissionsGuard } from './guards/permissions.guard';
import { User } from '../auth/entities/user.entity';

@Global() // لجعله متاحاً في كل التطبيق دون استيراده بكثرة
@Module({
  imports: [TypeOrmModule.forFeature([AdminRole, AdminUser, Permission, AdminAuditLog, User])],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard], // لتتمكن الموديلات الأخرى من استخدام الحارس
})
export class RbacModule {}
