const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const config = {
  host: '81.0.221.169',
  port: 22,
  username: 'root',
  password: 'dn13cpc@LfQT6soj',
  readyTimeout: 20000
};

const filesToUpload = [
  {
    local: 'src/modules/content/controllers/content.controller.ts',
    remote: '/opt/faiera/backend/src/modules/content/controllers/content.controller.ts'
  },
  {
    local: 'src/modules/content/interceptors/course-compat.interceptor.ts',
    remote: '/opt/faiera/backend/src/modules/content/interceptors/course-compat.interceptor.ts'
  },
  {
    local: 'src/modules/auth/guards/jwt-auth.guard.ts',
    remote: '/opt/faiera/backend/src/modules/auth/guards/jwt-auth.guard.ts'
  },
  {
    local: 'src/modules/progress/services/progress.service.ts',
    remote: '/opt/faiera/backend/src/modules/progress/services/progress.service.ts'
  }
];

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    // First ensure the interceptors directory exists
    sftp.mkdir('/opt/faiera/backend/src/modules/content/interceptors', (err) => {
      // Ignore directory exists error
      
      let uploaded = 0;
      filesToUpload.forEach(file => {
        const localPath = path.join(__dirname, file.local);
        sftp.fastPut(localPath, file.remote, (err) => {
          if (err) {
            console.error('Error uploading ' + file.local, err);
          } else {
            console.log('Uploaded: ' + file.local);
          }
          uploaded++;
          
          if (uploaded === filesToUpload.length) {
            console.log('All files uploaded. Rebuilding Docker...');
            
            // Files uploaded, now execute the rebuild command
            const rebuildCmd = 'cd /opt/faiera/backend && docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build';
            
            conn.exec(rebuildCmd, (err, stream) => {
              if (err) throw err;
              stream.on('close', (code, signal) => {
                console.log('Docker rebuild finished with code ' + code);
                conn.end();
              }).on('data', (data) => {
                process.stdout.write(data);
              }).stderr.on('data', (data) => {
                process.stderr.write(data);
              });
            });
          }
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect(config);
