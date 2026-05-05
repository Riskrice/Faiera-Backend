import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuestionCategoriesAndQuestionCategoryId1778000000000 implements MigrationInterface {
  name = 'AddQuestionCategoriesAndQuestionCategoryId1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "nameAr" character varying(255) NOT NULL,
        "nameEn" character varying(255) NOT NULL,
        "description" text,
        "parentId" uuid,
        "createdBy" uuid,
        CONSTRAINT "PK_question_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "nameAr" character varying(255) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "nameEn" character varying(255) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "description" text
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "parentId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "question_categories"
      ADD COLUMN IF NOT EXISTS "createdBy" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_categories_parentId"
      ON "question_categories" ("parentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_categories_createdBy"
      ON "question_categories" ("createdBy")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'question_categories' AND constraint_name = 'FK_question_categories_parent'
        ) THEN
          ALTER TABLE "question_categories"
          ADD CONSTRAINT "FK_question_categories_parent"
          FOREIGN KEY ("parentId") REFERENCES "question_categories"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN IF NOT EXISTS "categoryId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_categoryId"
      ON "questions" ("categoryId")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'questions' AND constraint_name = 'FK_questions_category'
        ) THEN
          ALTER TABLE "questions"
          ADD CONSTRAINT "FK_questions_category"
          FOREIGN KEY ("categoryId") REFERENCES "question_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "FK_questions_category"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_questions_categoryId"
    `);
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN IF EXISTS "categoryId"
    `);
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN IF EXISTS "sortOrder"
    `);

    await queryRunner.query(`
      ALTER TABLE "question_categories" DROP CONSTRAINT IF EXISTS "FK_question_categories_parent"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_question_categories_parentId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_question_categories_createdBy"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "question_categories"
    `);
  }
}