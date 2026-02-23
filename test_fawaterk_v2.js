
require('dotenv').config();
const axios = require('axios');

async function testFawaterk() {
    const apiKey = process.env.FAWATERK_API_KEY;
    const baseUrl = process.env.FAWATERK_BASE_URL;

    console.log('Testing Fawaterk Integration (Staging) with payment_method_id...');

    const payload = {
        cartTotal: 100,
        currency: 'EGP',
        customer: {
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            phone: '01012345678',
            address: 'Online'
        },
        redirectionUrls: {
            successUrl: 'http://localhost:3000/success',
            failUrl: 'http://localhost:3000/fail',
            pendingUrl: 'http://localhost:3000/pending'
        },
        cartItems: [
            {
                name: 'Test Item',
                price: 100,
                quantity: 1
            }
        ],
        payment_method_id: 2, // TRYING ID 2 (Maybe Card?)
        payLoad: {
            custom_field_1: 'test_user_id'
        },
        sendEmail: true,
        sendSMS: false
    };

    try {
        const response = await axios.post(
            `${baseUrl}/invoiceInitPay`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log('✅ Success!');
        console.dir(response.data, { depth: null });

    } catch (error) {
        console.error('❌ Failed:', error.message);
        if (error.response) {
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testFawaterk();
