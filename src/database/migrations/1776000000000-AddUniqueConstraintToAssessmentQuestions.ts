import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToAssessmentQuestions1776000000000 implements MigrationInterface {
  name = 'AddUniqueConstraintToAssessmentQuestions1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query(`
      SELECT "assessmentId", "questionId", COUNT(*)::int AS duplicates
      FROM "assessment_questions"
      GROUP BY "assessmentId", "questionId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, "assessmentId" ASC, "questionId" ASC
      LIMIT 10
    `);

    if (duplicates.length > 0) {
      const sample = duplicates
        .map(
          (row: { assessmentId: string; questionId: string; duplicates: number }) =>
            `${row.assessmentId}:${row.questionId}(${row.duplicates})`,
        )
        .join(', ');

      throw new Error(
        `Cannot add unique constraint on assessment_questions(assessmentId, questionId). ` +
          `Duplicate rows exist. Sample duplicates: ${sample}`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assessment_questions_assessmentId_questionId"
      ON "assessment_questions" ("assessmentId", "questionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_assessment_questions_assessmentId_questionId"`,
    );
  }
}
