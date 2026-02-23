
require('dotenv').config();
const axios = require('axios');

async function getPaymentMethods() {
    const apiKey = process.env.FAWATERK_API_KEY;
    const baseUrl = process.env.FAWATERK_BASE_URL;

    console.log('Fetching Payment Methods...');

    try {
        const response = await axios.get(
            `${baseUrl}/getPaymentMethods`,
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

getPaymentMethods();
