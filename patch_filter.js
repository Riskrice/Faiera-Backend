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
    // Patch all-exceptions.filter.js in the container to log exceptionResponse
    const command = `docker exec faiera-api sed -i "s/message = exceptionResponse;/message = exceptionResponse; console.log('VALIDATION_ERROR_STRING:', exceptionResponse);/" dist/common/filters/all-exceptions.filter.js && docker exec faiera-api sed -i "s/message = responseObj.message || message;/message = responseObj.message || message; console.log('VALIDATION_ERROR_OBJ:', responseObj);/" dist/common/filters/all-exceptions.filter.js && docker restart faiera-api`;
    
    conn.exec(command, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', () => {
            console.log(output);
            conn.end();
        }).on('data', data => output += data)
          .stderr.on('data', data => output += data);
    });
}).connect(sshConfig);
