import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherToCourse1771777279542 implements MigrationInterface {
    name = 'AddTeacherToCourse1771777279542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add column only if it doesn't exist
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'courses' AND column_name = 'teacherId'
                ) THEN
                    ALTER TABLE "courses" ADD "teacherId" uuid;
                END IF;
            END $$;
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f921bd9bb6d061b90d386fa372" ON "courses" ("teacherId")`);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_f921bd9bb6d061b90d386fa3721'
                ) THEN
                    ALTER TABLE "courses" ADD CONSTRAINT "FK_f921bd9bb6d061b90d386fa3721" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "FK_f921bd9bb6d061b90d386fa3721"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f921bd9bb6d061b90d386fa372"`);
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'courses' AND column_name = 'teacherId'
                ) THEN
                    ALTER TABLE "courses" DROP COLUMN "teacherId";
                END IF;
            END $$;
        `);
    }
}
