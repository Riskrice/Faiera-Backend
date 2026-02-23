import { registerAs } from '@nestjs/config';

export default registerAs('fawaterk', () => ({
  apiKey: process.env.FAWATERK_API_KEY,
  // Using production URL as default since keys are real
  baseUrl: process.env.FAWATERK_BASE_URL || 'https://app.fawaterk.com/api/v2',
}));
