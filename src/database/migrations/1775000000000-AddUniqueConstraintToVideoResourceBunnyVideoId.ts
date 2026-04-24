import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToVideoResourceBunnyVideoId1775000000000 implements MigrationInterface {
  name = 'AddUniqueConstraintToVideoResourceBunnyVideoId1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query(`
            SELECT "bunnyVideoId", COUNT(*)::int AS duplicates
            FROM "video_resources"
            GROUP BY "bunnyVideoId"
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC, "bunnyVideoId" ASC
            LIMIT 10
        `);

    if (duplicates.length > 0) {
      const sample = duplicates
        .map(
          (row: { bunnyVideoId: string; duplicates: number }) =>
            `${row.bunnyVideoId}(${row.duplicates})`,
        )
        .join(', ');

      throw new Error(
        `Cannot add unique constraint on video_resources.bunnyVideoId. Duplicate values exist. ` +
          `Run scripts/merge-orphaned-bunny-videos.ts first. Sample duplicates: ${sample}`,
      );
    }

    await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_video_resources_bunnyVideoId"
            ON "video_resources" ("bunnyVideoId")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_video_resources_bunnyVideoId"`);
  }
}
