import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRbacAdminManagement1774000000000 implements MigrationInterface {
  name = 'CreateRbacAdminManagement1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_users_previousrole_enum') THEN
                    CREATE TYPE "admin_users_previousrole_enum" AS ENUM ('student', 'teacher', 'parent', 'admin', 'super_admin');
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permissions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" character varying(120),
                "action" character varying(50) NOT NULL,
                "resource" character varying(50) NOT NULL,
                "description" text,
                CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "name" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_permissions_action_resource" ON "permissions" ("action", "resource")`,
    );

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_roles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" character varying(100) NOT NULL,
                "description" text,
                "isSystem" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_admin_roles" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_roles' AND column_name = 'is_system'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_roles' AND column_name = 'isSystem'
                ) THEN
                    ALTER TABLE "admin_roles" RENAME COLUMN "is_system" TO "isSystem";
                END IF;
            END $$;
        `);
    await queryRunner.query(
      `ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_admin_roles_name" ON "admin_roles" ("name")`,
    );

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_role_permissions" (
                "roleId" uuid NOT NULL,
                "permissionId" uuid NOT NULL,
                CONSTRAINT "PK_admin_role_permissions" PRIMARY KEY ("roleId", "permissionId")
            )
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_role_permissions' AND column_name = 'role_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_role_permissions' AND column_name = 'roleId'
                ) THEN
                    ALTER TABLE "admin_role_permissions" RENAME COLUMN "role_id" TO "roleId";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_role_permissions' AND column_name = 'permission_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_role_permissions' AND column_name = 'permissionId'
                ) THEN
                    ALTER TABLE "admin_role_permissions" RENAME COLUMN "permission_id" TO "permissionId";
                END IF;
            END $$;
        `);
    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" ADD COLUMN IF NOT EXISTS "roleId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" ADD COLUMN IF NOT EXISTS "permissionId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" ALTER COLUMN "roleId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" ALTER COLUMN "permissionId" SET NOT NULL`,
    );

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_role_permissions' AND constraint_name = 'FK_admin_role_permissions_role'
                ) THEN
                    ALTER TABLE "admin_role_permissions"
                    ADD CONSTRAINT "FK_admin_role_permissions_role"
                    FOREIGN KEY ("roleId") REFERENCES "admin_roles"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_role_permissions' AND constraint_name = 'FK_admin_role_permissions_permission'
                ) THEN
                    ALTER TABLE "admin_role_permissions"
                    ADD CONSTRAINT "FK_admin_role_permissions_permission"
                    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "userId" uuid NOT NULL,
                "roleId" uuid NOT NULL,
                "assignedById" uuid,
                "previousRole" "admin_users_previousrole_enum",
                "revokedAt" TIMESTAMP WITH TIME ZONE,
                "revokedById" uuid,
                CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'user_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'userId'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "user_id" TO "userId";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'role_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'roleId'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "role_id" TO "roleId";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'assigned_by_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'assignedById'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "assigned_by_id" TO "assignedById";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'revoked_by_id'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'revokedById'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "revoked_by_id" TO "revokedById";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'revoked_at'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'revokedAt'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "revoked_at" TO "revokedAt";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'previous_role'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'admin_users' AND column_name = 'previousRole'
                ) THEN
                    ALTER TABLE "admin_users" RENAME COLUMN "previous_role" TO "previousRole";
                END IF;
            END $$;
        `);
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "assignedById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "previousRole" "admin_users_previousrole_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "revokedById" uuid`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_admin_users_userId" ON "admin_users" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_users_roleId" ON "admin_users" ("roleId")`,
    );

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_users' AND constraint_name = 'FK_admin_users_userId_users'
                ) THEN
                    ALTER TABLE "admin_users"
                    ADD CONSTRAINT "FK_admin_users_userId_users"
                    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_users' AND constraint_name = 'FK_admin_users_roleId_admin_roles'
                ) THEN
                    ALTER TABLE "admin_users"
                    ADD CONSTRAINT "FK_admin_users_roleId_admin_roles"
                    FOREIGN KEY ("roleId") REFERENCES "admin_roles"("id") ON DELETE RESTRICT;
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_users' AND constraint_name = 'FK_admin_users_assignedById_users'
                ) THEN
                    ALTER TABLE "admin_users"
                    ADD CONSTRAINT "FK_admin_users_assignedById_users"
                    FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_users' AND constraint_name = 'FK_admin_users_revokedById_users'
                ) THEN
                    ALTER TABLE "admin_users"
                    ADD CONSTRAINT "FK_admin_users_revokedById_users"
                    FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "actorId" uuid NOT NULL,
                "targetUserId" uuid,
                "action" character varying(100) NOT NULL,
                "resource" character varying(100) NOT NULL,
                "details" jsonb,
                "ipAddress" character varying(45),
                "userAgent" text,
                CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "details" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "ipAddress" character varying(45)`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" text`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_actorId_createdAt" ON "admin_audit_logs" ("actorId", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_targetUserId" ON "admin_audit_logs" ("targetUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_action_resource" ON "admin_audit_logs" ("action", "resource")`,
    );

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_audit_logs' AND constraint_name = 'FK_admin_audit_actorId_users'
                ) THEN
                    ALTER TABLE "admin_audit_logs"
                    ADD CONSTRAINT "FK_admin_audit_actorId_users"
                    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'admin_audit_logs' AND constraint_name = 'FK_admin_audit_targetUserId_users'
                ) THEN
                    ALTER TABLE "admin_audit_logs"
                    ADD CONSTRAINT "FK_admin_audit_targetUserId_users"
                    FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_targetUserId_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_actorId_users"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_audit_action_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_audit_targetUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_audit_actorId_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);

    await queryRunner.query(
      `ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "FK_admin_users_revokedById_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "FK_admin_users_assignedById_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "FK_admin_users_roleId_admin_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "FK_admin_users_userId_users"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_users_roleId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_admin_users_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_users"`);

    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" DROP CONSTRAINT IF EXISTS "FK_admin_role_permissions_permission"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_role_permissions" DROP CONSTRAINT IF EXISTS "FK_admin_role_permissions_role"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_role_permissions"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_admin_roles_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_roles"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_action_resource"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "admin_users_previousrole_enum"`);
  }
}
