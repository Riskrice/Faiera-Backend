const { execSync } = require('child_process');
const { Client } = require('ssh2');

try {
    console.log("Committing local changes...");
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Fix promo code validation DTOs"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    console.log("Pushed to GitHub successfully.");
} catch (e) {
    console.log("Git error (might be nothing to commit):", e.message);
}

const sshConfig = {
    host: '81.0.221.169',
    port: 22,
    username: 'root',
    password: 'dn13cpc@LfQT6soj',
    readyTimeout: 60000
};

const conn = new Client();
conn.on('ready', () => {
    console.log("Connected to remote server. Pulling and rebuilding API...");
    // Rebuild the api service to compile new ts changes into dist/
    const command = 'cd /opt/faiera/backend && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build api';
    
    conn.exec(command, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log("Rebuild process exited with code " + code);
            conn.end();
        }).on('data', data => process.stdout.write(data))
          .stderr.on('data', data => process.stderr.write(data));
    });
}).connect(sshConfig);
