import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCascadeToTeacherProfile1773312925209 implements MigrationInterface {
  name = 'AddCascadeToTeacherProfile1773312925209';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing FK without cascade
    await queryRunner.query(`
            ALTER TABLE "teacher_profiles"
            DROP CONSTRAINT IF EXISTS "FK_c30bc3401758faae4415391ea23"
        `);

    // Re-add FK with ON DELETE CASCADE
    await queryRunner.query(`
            ALTER TABLE "teacher_profiles"
            ADD CONSTRAINT "FK_c30bc3401758faae4415391ea23"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to no cascade
    await queryRunner.query(`
            ALTER TABLE "teacher_profiles"
            DROP CONSTRAINT IF EXISTS "FK_c30bc3401758faae4415391ea23"
        `);

    await queryRunner.query(`
            ALTER TABLE "teacher_profiles"
            ADD CONSTRAINT "FK_c30bc3401758faae4415391ea23"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
        `);
  }
}
