import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedByToCourse1769084049486 implements MigrationInterface {
    name = 'AddCreatedByToCourse1769084049486'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD "createdBy" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_ff482a765c101d651ea0628874" ON "courses" ("createdBy") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ff482a765c101d651ea0628874"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "createdBy"`);
    }

}
