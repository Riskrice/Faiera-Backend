const { Client } = require('ssh2');

const conn = new Client();

const config = {
  host: '81.0.221.169',
  port: 22,
  username: 'root',
  password: 'dn13cpc@LfQT6soj',
  readyTimeout: 20000
};

const commands = [
  'echo "=== DOCKER PS ==="',
  'docker ps -a',
  'echo "=== DOCKER LOGS (API) ==="',
  'docker logs --tail 50 faiera-api',
  'echo "=== DOCKER LOGS (WEB) ==="',
  'docker logs --tail 50 faiera-web'
];

conn.on('ready', () => {
  const fullCommand = commands.join(' && ');
  
  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      process.stderr.write('STDERR: ' + data);
    });
  });
}).connect(config);
