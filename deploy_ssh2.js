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
  'echo "=== PULLING BACKEND ==="',
  'cd /opt/faiera/backend && git fetch origin && git reset --hard origin/main',
  'echo "=== PULLING FRONTEND ==="',
  'cd /opt/faiera/faiera-web && git fetch origin && git reset --hard origin/main',
  'echo "=== REBUILDING CONTAINERS ==="',
  'cd /opt/faiera/backend && docker compose --env-file .env -f docker/docker-compose.prod.yml down && docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build'
];

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const fullCommand = commands.join(' && ');
  
  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      process.stderr.write('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect(config);
