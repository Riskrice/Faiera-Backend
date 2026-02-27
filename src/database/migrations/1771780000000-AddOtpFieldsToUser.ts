import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtpFieldsToUser1771780000000 implements MigrationInterface {
    name = 'AddOtpFieldsToUser1771780000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "otpCode" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpExpiresAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpCode"`);
    }

}
