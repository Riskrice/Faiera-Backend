import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetFieldsToUser1771790000000 implements MigrationInterface {
    name = 'AddPasswordResetFieldsToUser1771790000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'passwordResetToken'
                ) THEN
                    ALTER TABLE "users" ADD "passwordResetToken" character varying(255);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'passwordResetExpires'
                ) THEN
                    ALTER TABLE "users" ADD "passwordResetExpires" TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetToken"`);
    }

}
