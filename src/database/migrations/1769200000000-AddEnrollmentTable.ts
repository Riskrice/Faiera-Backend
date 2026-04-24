import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnrollmentTable1769200000000 implements MigrationInterface {
  name = 'AddEnrollmentTable1769200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
                    CREATE TYPE "enrollment_status_enum" AS ENUM ('active', 'completed', 'expired', 'cancelled');
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_source_enum') THEN
                    CREATE TYPE "enrollment_source_enum" AS ENUM ('payment', 'subscription', 'admin_grant', 'free');
                END IF;
            END $$;
        `);
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "enrollments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userId" uuid NOT NULL,
                "courseId" uuid NOT NULL,
                "status" "enrollment_status_enum" NOT NULL DEFAULT 'active',
                "source" "enrollment_source_enum" NOT NULL DEFAULT 'payment',
                "transactionId" uuid,
                "enrolledAt" TIMESTAMP WITH TIME ZONE,
                "expiresAt" TIMESTAMP WITH TIME ZONE,
                "completedAt" TIMESTAMP WITH TIME ZONE,
                "progressPercent" integer NOT NULL DEFAULT 0,
                "metadata" jsonb,
                CONSTRAINT "UQ_enrollments_user_course" UNIQUE ("userId", "courseId"),
                CONSTRAINT "PK_enrollments" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_enrollments_userId" ON "enrollments" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_enrollments_courseId" ON "enrollments" ("courseId")`,
    );
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_enrollments_course'
                ) THEN
                    ALTER TABLE "enrollments"
                    ADD CONSTRAINT "FK_enrollments_course"
                    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "FK_enrollments_course"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_enrollments_courseId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_enrollments_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enrollments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "enrollment_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "enrollment_status_enum"`);
  }
}
