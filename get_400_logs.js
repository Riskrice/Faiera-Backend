const { Client } = require('ssh2');

const sshConfig = {
    host: '81.0.221.169',
    port: 22,
    username: 'root',
    password: 'dn13cpc@LfQT6soj',
    readyTimeout: 20000
};

const conn = new Client();
conn.on('ready', () => {
    conn.exec('docker logs --tail 200 faiera-api', (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', () => {
            console.log(output);
            conn.end();
        }).on('data', data => output += data)
          .stderr.on('data', data => output += data);
    });
}).connect(sshConfig);
