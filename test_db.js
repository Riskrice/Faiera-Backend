const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("node -v", (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (d) => console.log(d.toString())).stderr.on('data', (d) => console.log('STDERR: ' + d));
  });
}).connect({host: '81.0.221.169', port: 22, username: 'root', password: 'dn13cpc@LfQT6soj'});
