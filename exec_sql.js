const { Client } = require('ssh2');
const fs = require('fs');

const sshConfig = {
    host: '81.0.221.169',
    port: 22,
    username: 'root',
    password: 'dn13cpc@LfQT6soj',
    readyTimeout: 20000
};

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('docker exec -i faiera-postgres psql -U postgres -d faiera -c "SELECT l.id, l.\\"titleAr\\", l.videourl, l.\\"videoResourceId\\", m.\\"titleAr\\" as module FROM lessons l JOIN modules m ON l.\\"moduleId\\" = m.id WHERE m.\\"courseId\\" = \'b386c135-6a6f-44f9-a540-63ef632808fc\';"', (err, stream) => {
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
