import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpFieldsToUser1771780000000 implements MigrationInterface {
  name = 'AddOtpFieldsToUser1771780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'otpCode'
                ) THEN
                    ALTER TABLE "users" ADD "otpCode" character varying(255);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'otpExpiresAt'
                ) THEN
                    ALTER TABLE "users" ADD "otpExpiresAt" TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "otpExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "otpCode"`);
  }
}
