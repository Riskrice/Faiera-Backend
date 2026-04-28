const { Client } = require('ssh2');

const sshConfig = {
    host: '81.0.221.169',
    port: 22,
    username: 'root',
    password: 'dn13cpc@LfQT6soj',
    readyTimeout: 20000
};

const sql = `
WITH new_video AS (
  INSERT INTO video_resources (title, \\"bunnyVideoId\\", \\"libraryId\\", status) 
  VALUES ('مرحباً بكم في الكورس', '5300879f-28d2-4adf-8952-82cff798d6ad', '588852', 'ready') 
  RETURNING id
)
UPDATE lessons 
SET \\"videoResourceId\\" = (SELECT id FROM new_video) 
WHERE id = '33b62f63-876a-40ec-8d7a-b1dd6472f38f';
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec(`docker exec -i faiera-postgres psql -U postgres -d faiera -c "${sql.replace(/\n/g, ' ')}"`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(sshConfig);
