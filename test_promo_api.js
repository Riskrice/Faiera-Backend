const axios = require('axios');

async function testPromoCode() {
    try {
        const loginRes = await axios.post('https://api.faiera.com/api/v1/auth/login', {
            email: 'admin@faiera.com',
            password: 'P@ssword123!'
        });
        const token = loginRes.data.data.accessToken;

        const payload = {
            count: 10,
            codeLength: 8,
            discountType: "percentage",
            discountValue: 20,
            scope: "global",
            startsAt: new Date().toISOString(),
            maxUsesPerUser: 1
        };

        try {
            const res = await axios.post('https://api.faiera.com/api/v1/promo-codes/generate', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('SUCCESS:', res.data);
        } catch (e) {
            console.log('ERROR:', JSON.stringify(e.response?.data, null, 2));
        }

        const createPayload = {
            code: 'TESTCODE99',
            discountType: 'percentage',
            discountValue: 10,
            scope: 'global',
            startsAt: new Date().toISOString(),
            maxUsesPerUser: 1,
            isActive: true
        };

        try {
            const res = await axios.post('https://api.faiera.com/api/v1/promo-codes', createPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('SUCCESS CREATE:', res.data);
        } catch (e) {
            console.log('ERROR CREATE:', JSON.stringify(e.response?.data, null, 2));
        }
    } catch (e) {
        console.error('Login failed', e.message);
    }
}
testPromoCode();
