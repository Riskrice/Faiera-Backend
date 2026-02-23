import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/v1/sessions/google/callback',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
}));
