const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const { Client } = require('pg');
    const client = new Client({
      user: process.env.DB_USERNAME || 'postgres',
      host: process.env.DB_HOST || 'faiera-postgres',
      database: process.env.DB_DATABASE || 'faiera',
      password: process.env.DB_PASSWORD || 'postgrespassword',
      port: 5432,
    });

    async function run() {
      await client.connect();
      try {
        const catRes = await client.query(
          \`INSERT INTO question_categories ("nameAr", "nameEn", "description") 
          VALUES ('المكتبة العامة', 'General Library', 'جميع الأسئلة') 
          RETURNING id;\`
        );
        const categoryId = catRes.rows[0].id;
        console.log('Created category with ID:', categoryId);

        const updateRes = await client.query(
          \`UPDATE questions SET "categoryId" = $1 WHERE "categoryId" IS NULL;\`,
          [categoryId]
        );
        console.log('Updated questions count:', updateRes.rowCount);

        const questionsRes = await client.query('SELECT id, "answerData" FROM questions');
        let fixedCount = 0;
        for (const q of questionsRes.rows) {
          if (q.answerData && Array.isArray(q.answerData)) {
            let changed = false;
            const newData = q.answerData.map(ans => {
              if (typeof ans.isCorrect === 'string') {
                ans.isCorrect = String(ans.isCorrect).toLowerCase() === 'true';
                changed = true;
              }
              return ans;
            });
            if (changed) {
              await client.query('UPDATE questions SET "answerData" = $1 WHERE id = $2', [JSON.stringify(newData), q.id]);
              fixedCount++;
            }
          }
        }
        console.log('Fixed answerData boolean types for', fixedCount, 'questions');
      } catch (err) {
        console.error('Error:', err);
      } finally {
        await client.end();
      }
    }
    run();
  `;

  // Provide raw script securely via stdin to node inside the docker container
  const _ = conn.exec('docker exec -i faiera-api node', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => console.log('STDOUT:', d.toString())).stderr.on('data', d => console.error('STDERR:', d.toString()));
    stream.write(script);
    stream.end();
  });

}).connect({
  host: '81.0.221.169',
  port: 22,
  username: 'root',
  password: 'dn13cpc@LfQT6soj'
});
