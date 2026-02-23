
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const BASE_URL = 'http://localhost:4000/api/v1';

async function testUpload() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'superadmin@faiera.com',
            password: 'P@ssword123!'
        });
        const token = loginRes.data.data.tokens.accessToken;
        console.log('Login successful');

        // 2. Create dummy image
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        const filePath = path.join(__dirname, 'test.png');
        fs.writeFileSync(filePath, buffer);

        // 3. Upload
        console.log('Uploading image...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: 'test.png',
            contentType: 'image/png',
        });

        const uploadRes = await axios.post(`${BASE_URL}/upload/image`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            },
            validateStatus: () => true // Don't throw on error
        });

        console.log('Status:', uploadRes.status);
        console.log('Data:', JSON.stringify(uploadRes.data, null, 2));

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testUpload();
