const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testApi() {
    const payload = {
        sub: '14cfc7cb-b165-4b5d-9594-9edfb485c13c',
        email: 'superadmin@faiera.com',
        role: 'super_admin'
    };
    
    // The JWT_SECRET from .env
    const secret = 'f41er4-pr0d-jwt-s3cr3t-k3y-X9mK2pL7qR4wZ8';
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    console.log("Generated Token:", token);

    const generatePayload = {
        count: 10,
        codeLength: 8,
        discountType: "percentage",
        discountValue: 20,
        scope: "global",
        startsAt: new Date().toISOString(),
        maxUsesPerUser: 1
    };

    try {
        const res = await axios.post('https://api.faiera.com/api/v1/promo-codes/generate', generatePayload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('SUCCESS:', res.data);
    } catch (e) {
        console.log('ERROR STATUS:', e.response?.status);
        console.log('ERROR DATA:', JSON.stringify(e.response?.data, null, 2));
    }
}
testApi();
