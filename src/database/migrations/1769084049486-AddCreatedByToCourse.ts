import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedByToCourse1769084049486 implements MigrationInterface {
    name = 'AddCreatedByToCourse1769084049486'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'courses' AND column_name = 'createdBy'
                ) THEN
                    ALTER TABLE "courses" ADD "createdBy" uuid;
                END IF;
            END $$;
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ff482a765c101d651ea0628874" ON "courses" ("createdBy") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ff482a765c101d651ea0628874"`);
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'courses' AND column_name = 'createdBy'
                ) THEN
                    ALTER TABLE "courses" DROP COLUMN "createdBy";
                END IF;
            END $$;
        `);
    }

}
