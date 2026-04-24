import dataSource from '../src/database/data-source';

interface VideoResourceRow {
    id: string;
    bunnyVideoId: string;
    status: string;
    durationSeconds: number;
    thumbnailUrl: string | null;
    created_at: string;
    linkedLessonCount: number;
}

interface DuplicateAction {
    canonicalId: string;
    duplicateId: string;
    bunnyVideoId: string;
    duplicateLinkedLessons: number;
    shouldPromoteDuration: boolean;
    shouldPromoteThumbnail: boolean;
}

function hasArg(name: string): boolean {
    return process.argv.includes(name);
}

function pickCanonical(rows: VideoResourceRow[]): VideoResourceRow {
    return [...rows].sort((a, b) => {
        if (a.linkedLessonCount !== b.linkedLessonCount) {
            return b.linkedLessonCount - a.linkedLessonCount;
        }

        if (a.status === 'ready' && b.status !== 'ready') {
            return -1;
        }

        if (b.status === 'ready' && a.status !== 'ready') {
            return 1;
        }

        if ((a.durationSeconds || 0) !== (b.durationSeconds || 0)) {
            return (b.durationSeconds || 0) - (a.durationSeconds || 0);
        }

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })[0];
}

async function main(): Promise<void> {
    const apply = hasArg('--apply');
    const dryRun = !apply;

    console.log(`Bunny orphan/duplicate merge started (dryRun=${dryRun})`);

    await dataSource.initialize();

    try {
        const rows = (await dataSource.query(`
            SELECT
                vr.id,
                vr."bunnyVideoId",
                vr.status,
                vr."durationSeconds",
                vr."thumbnailUrl",
                vr.created_at,
                COUNT(l.id)::int AS "linkedLessonCount"
            FROM "video_resources" vr
            LEFT JOIN "lessons" l
                ON l."videoResourceId" = vr.id
            GROUP BY vr.id
            ORDER BY vr."bunnyVideoId" ASC, vr.created_at ASC
        `)) as VideoResourceRow[];

        const byBunnyId = new Map<string, VideoResourceRow[]>();
        for (const row of rows) {
            if (!byBunnyId.has(row.bunnyVideoId)) {
                byBunnyId.set(row.bunnyVideoId, []);
            }
            byBunnyId.get(row.bunnyVideoId)!.push(row);
        }

        const duplicateGroups = [...byBunnyId.entries()]
            .filter(([, group]) => group.length > 1)
            .sort((a, b) => b[1].length - a[1].length);

        const orphanCount = rows.filter((row) => row.linkedLessonCount === 0).length;

        console.log(`Total video_resources: ${rows.length}`);
        console.log(`Duplicate bunnyVideoId groups: ${duplicateGroups.length}`);
        console.log(`Orphaned rows (no linked lessons): ${orphanCount}`);

        const actions: DuplicateAction[] = [];

        for (const [bunnyVideoId, group] of duplicateGroups) {
            const canonical = pickCanonical(group);
            const duplicates = group.filter((row) => row.id !== canonical.id);

            for (const duplicate of duplicates) {
                actions.push({
                    canonicalId: canonical.id,
                    duplicateId: duplicate.id,
                    bunnyVideoId,
                    duplicateLinkedLessons: duplicate.linkedLessonCount,
                    shouldPromoteDuration:
                        (canonical.durationSeconds || 0) < (duplicate.durationSeconds || 0),
                    shouldPromoteThumbnail:
                        !canonical.thumbnailUrl && !!duplicate.thumbnailUrl,
                });
            }
        }

        if (actions.length === 0) {
            console.log('No duplicate bunnyVideoId rows found. Nothing to merge.');
            return;
        }

        console.log(`Planned merge actions: ${actions.length}`);
        for (const action of actions.slice(0, 25)) {
            console.log(
                `- bunnyVideoId=${action.bunnyVideoId} canonical=${action.canonicalId} duplicate=${action.duplicateId} linkedLessons=${action.duplicateLinkedLessons}`,
            );
        }

        if (actions.length > 25) {
            console.log(`...and ${actions.length - 25} more actions`);
        }

        if (dryRun) {
            console.log('Dry-run mode enabled. No database changes were made.');
            console.log('Run with --apply to execute merge operations.');
            return;
        }

        await dataSource.transaction(async (manager) => {
            for (const action of actions) {
                if (action.shouldPromoteDuration || action.shouldPromoteThumbnail) {
                    await manager.query(
                        `
                        UPDATE "video_resources" canonical
                        SET
                            "durationSeconds" = CASE
                                WHEN canonical."durationSeconds" < duplicate."durationSeconds"
                                    THEN duplicate."durationSeconds"
                                ELSE canonical."durationSeconds"
                            END,
                            "thumbnailUrl" = CASE
                                WHEN canonical."thumbnailUrl" IS NULL AND duplicate."thumbnailUrl" IS NOT NULL
                                    THEN duplicate."thumbnailUrl"
                                ELSE canonical."thumbnailUrl"
                            END
                        FROM "video_resources" duplicate
                        WHERE canonical.id = $1
                          AND duplicate.id = $2
                        `,
                        [action.canonicalId, action.duplicateId],
                    );
                }

                await manager.query(
                    `
                    UPDATE "lessons"
                    SET "videoResourceId" = $1
                    WHERE "videoResourceId" = $2
                    `,
                    [action.canonicalId, action.duplicateId],
                );

                await manager.query(
                    `
                    DELETE FROM "video_resources"
                    WHERE id = $1
                    `,
                    [action.duplicateId],
                );
            }
        });

        console.log(`Applied merge actions successfully: ${actions.length}`);
    } finally {
        await dataSource.destroy();
    }
}

main().catch((error) => {
    console.error('Bunny orphan merge script failed:', error);
    process.exit(1);
});