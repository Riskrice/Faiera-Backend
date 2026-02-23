const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'faiera',
    });

    await client.connect();
    const hash = await bcrypt.hash('P@ssword123!', 10);
    console.log('New hash:', hash);

    const result = await client.query(
        "UPDATE users SET password = $1 WHERE email IN ('superadmin@faiera.com','admin@faiera.com','teacher@faiera.com','student@faiera.com')",
        [hash]
    );

    console.log('Updated rows:', result.rowCount);
    await client.end();
    console.log('Done!');
})();
