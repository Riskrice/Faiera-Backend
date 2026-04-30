import { registerAs } from '@nestjs/config';

export default registerAs('paymob', () => {
  const config = {
    // API Keys
    secretKey: process.env.PAYMOB_SECRET_KEY || '',
    publicKey: process.env.PAYMOB_PUBLIC_KEY || '',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',

    // Base URL (same for sandbox and production)
    baseUrl: process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com',

    // Integration IDs — each payment method has its own ID from Paymob Dashboard
    integrationIds: {
      card: parseInt(process.env.PAYMOB_CARD_INTEGRATION_ID || '0', 10),
      wallet: parseInt(process.env.PAYMOB_WALLET_INTEGRATION_ID || '0', 10),
      kiosk: parseInt(process.env.PAYMOB_KIOSK_INTEGRATION_ID || '0', 10),
      valu: parseInt(process.env.PAYMOB_VALU_INTEGRATION_ID || '0', 10),
      applePay: parseInt(process.env.PAYMOB_APPLEPAY_INTEGRATION_ID || '0', 10),
      googlePay: parseInt(process.env.PAYMOB_GOOGLEPAY_INTEGRATION_ID || '0', 10),
    },
  };

  return config;
});
