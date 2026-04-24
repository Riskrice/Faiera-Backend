import { DataSource } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { AdminRole } from './entities/admin-role.entity';

export const runRbacSeeder = async (dataSource: DataSource) => {
  console.log('🌱 Starting RBAC Seeder...');
  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(AdminRole);

  // 1) تعريف الصلاحيات المركزية للنظام
  const defaultPermissions = [
    { name: 'Full Access', action: 'manage', resource: 'all', description: 'إدارة كاملة للنظام' },
    { name: 'View Admins', action: 'view', resource: 'admins', description: 'عرض المشرفين' },
    {
      name: 'Manage Admins',
      action: 'manage',
      resource: 'admins',
      description: 'إضافة/تعديل/إيقاف المشرفين',
    },
    {
      name: 'View Roles',
      action: 'view',
      resource: 'roles',
      description: 'عرض الأدوار والصلاحيات',
    },
    {
      name: 'Manage Roles',
      action: 'manage',
      resource: 'roles',
      description: 'إدارة الأدوار والصلاحيات',
    },
    {
      name: 'View Audit',
      action: 'view',
      resource: 'audit',
      description: 'عرض سجل تدقيق عمليات الإدارة',
    },
    { name: 'View Users', action: 'view', resource: 'users', description: 'عرض المستخدمين' },
    { name: 'Manage Users', action: 'manage', resource: 'users', description: 'إدارة المستخدمين' },
    {
      name: 'View Courses',
      action: 'view',
      resource: 'courses',
      description: 'عرض المحتوى التعليمي',
    },
    {
      name: 'Manage Courses',
      action: 'manage',
      resource: 'courses',
      description: 'إدارة المحتوى التعليمي',
    },
    { name: 'View Payments', action: 'view', resource: 'payments', description: 'عرض المدفوعات' },
    {
      name: 'Manage Payments',
      action: 'manage',
      resource: 'payments',
      description: 'إدارة المدفوعات والاشتراكات',
    },
    {
      name: 'Manage Settings',
      action: 'manage',
      resource: 'settings',
      description: 'إدارة إعدادات المنصة',
    },
  ];

  const savedPermissions: Permission[] = [];

  // تخزين/تحديث الصلاحيات
  for (const p of defaultPermissions) {
    let exists = await permissionRepo.findOne({
      where: { action: p.action, resource: p.resource },
    });
    if (!exists) {
      exists = permissionRepo.create(p);
      await permissionRepo.save(exists);
      console.log(`✅ Permission created: ${p.action}:${p.resource}`);
    } else {
      exists.name = p.name;
      exists.description = p.description;
      await permissionRepo.save(exists);
    }
    savedPermissions.push(exists);
  }

  // 2) إنشاء دور "Super Admin" الافتراضي
  let superAdminRole = await roleRepo.findOne({
    where: { name: 'Super Admin' },
    relations: ['permissions'],
  });
  if (!superAdminRole) {
    superAdminRole = roleRepo.create({
      name: 'Super Admin',
      description: 'يملك كافة الصلاحيات المتاحة في النظام (المالك الرئيسي)',
      isSystem: true,
      permissions: savedPermissions,
    });
    await roleRepo.save(superAdminRole);
    console.log('👑 Super Admin role created.');
  } else {
    // تحديث الصلاحيات إذا تغيرت
    superAdminRole.isSystem = true;
    superAdminRole.permissions = savedPermissions;
    await roleRepo.save(superAdminRole);
    console.log('👑 Super Admin role updated with latest permissions.');
  }

  // 3) دور Support Agent افتراضي للقراءة فقط
  let supportRole = await roleRepo.findOne({ where: { name: 'Support Agent' } });
  if (!supportRole) {
    const supportPermissions = savedPermissions.filter(
      p =>
        (p.action === 'view' && p.resource === 'users') ||
        (p.action === 'view' && p.resource === 'payments') ||
        (p.action === 'view' && p.resource === 'audit'),
    );

    supportRole = roleRepo.create({
      name: 'Support Agent',
      description: 'موظف خدمة عملاء يمكنه رؤية المستخدمين والمدفوعات فقط بدون تعديل',
      isSystem: false,
      permissions: supportPermissions,
    });
    await roleRepo.save(supportRole);
    console.log('🎧 Support Agent role created.');
  }

  console.log('✅ RBAC Seeding Completed!');
};
