# نظام صلاحيات المديرين (Role-Based Access Control - RBAC) - الخطة المعمارية والتصميم

## 1. الفلسفة المعمارية للمعايير العالمية (Vercel, Stripe, GitHub Models)
لإنشاء نظام إدارة بصلاحيات دقيقة (Fine-Grained Permissions) بأعلى معايير الـ UI/UX و Security، نعتمد على هيكل **RBAC المُعزز** والذي يفصل بين "المناصب/الأدوار" (Roles) و "الصلاحيات" (Permissions).

### الهيكل الهندسي لقاعدة البيانات (PostgreSQL/Supabase)
```sql
-- 1. جدول الصلاحيات المركزية (System Permissions)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(50) NOT NULL,    -- ex: 'create', 'read', 'update', 'delete', 'manage'
  resource VARCHAR(50) NOT NULL,  -- ex: 'users', 'courses', 'payments', 'settings'
  description TEXT,
  UNIQUE(action, resource)
);
-- أمثلة: (manage, users), (read, courses), (update, settings)

-- 2. جدول الأدوار/المناصب المخصصة للوحة التحكم (Admin Roles)
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE, -- ex: 'Super Admin', 'Support Agent', 'Content Reviewer'
  description TEXT,
  is_system BOOLEAN DEFAULT false -- To prevent deleting core roles
);

-- 3. جدول الربط بين الأدوار والصلاحيات (Role Permissions)
CREATE TABLE admin_role_permissions (
  role_id UUID REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. إسناد دور لمشرف (Admin Users Mapping)
CREATE TABLE admin_users (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES admin_roles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);
```

## 2. معايير الـ UI/UX والواجهات الأمامية (Next.js & Frontend)
سنعتمد على تصميم احترافي Premium يشبه واجهات (Linear, Vercel) يعتمد على:
1. **صفحة Team & Access / فريق العمل**:
   - جدول (Data Table) يعرض جميع المديرين، بريدهم الإلكتروني، والدور الحالي (Role Badge).
   - زر "دعوة عضو جديد" يفتح Modal (Sheet/Dialog) أنيق.
2. **شاشة دعوة مشرف جديد (Invite Admin)**:
   - تحديد الإيميل (Search/Invite).
   - اختيار الدور (Role Dropdown) مع عرض وصف كل دور.
3. **شاشة إدارة الأدوار (Roles & Permissions Builder)**:
   - تصميم Grid يضم الوحدات (Users, Finance, Content).
   - Checkboxes لكل وحدة (View, Create, Edit, Delete) مع خيار "Select All" للأدوار المخصصة.
4. **التجربة (UX)**:
   - **Optimistic UI**: التحديث الفوري للحالة قبل رد السيرفر.
   - **Audit Logs**: عرض سجل التغييرات لكل مدير (من أضاف الصلاحية ومتى).

## 3. معايير الـ Backend والـ Security (NestJS API)
1. **Permission Guard**:
   تعديل/إنشاء حارس مصادقة (Guard) للتحقق من الصلاحيات المحددة بدلاً من الأدوار الجامدة.
   ```typescript
   @RequirePermissions({ action: 'delete', resource: 'users' })
   @Delete(':id')
   removeUser(@Param('id') id: string) { ... }
   ```
2. **Caching**:
   تخزين صلاحيات المشرفين النشطين في **Redis** لعدم إرهاق قاعدة البيانات مع كل طلب، ويتم مسح الـ Cache بمجرد تعديل أي صلاحية للمشرف.
3. **Audit Trails**:
   تسجيل أي تعديل في صلاحيات ومشرفي النظام (Activity Logs).

## 4. خطوات التنفيذ المرحلية (Roadmap)
- **المرحلة الأولى**: إنشاء الجداول الأربعة (Migrations) في قاعدة البيانات (Supabase/PostgreSQL) وإدخال الصلاحيات الأساسية (Seeders).
- **المرحلة الثانية**: بناء الـ Guards والـ Middleware في NestJS والتأكد من أمان المسارات الحالية للوحة تحكم.
- **المرحلة الثالثة**: بناء واجهات الـ UI (Admins List, Role Builder, Invite Admin Modal) في موقع `faiera-web` واستخدام مكونات Shadcn-UI.
- **المرحلة الرابعة**: ربط الواجهات بالـ API واختبار الحالات الحدوية (Edge Cases) مثل منع الـ Admin من حذف نفسه أو تعديل صلاحياته.
