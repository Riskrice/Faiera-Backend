
require('dotenv').config();
const axios = require('axios');

async function testCreateInvoiceLink() {
    const apiKey = process.env.FAWATERK_API_KEY;
    const baseUrl = process.env.FAWATERK_BASE_URL;

    console.log('Testing createInvoiceLink Endpoint...');

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
        cartItems: [
            {
                name: 'Test Item',
                price: 100,
                quantity: 1
            }
        ],
        sendEmail: true,
        sendSMS: false
    };

    try {
        const response = await axios.post(
            `${baseUrl}/createInvoiceLink`,
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

testCreateInvoiceLink();
