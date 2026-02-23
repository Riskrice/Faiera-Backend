import { registerAs } from '@nestjs/config';

export default registerAs('bunny', () => ({
    apiKey: process.env.BUNNY_API_KEY,
    libraryId: process.env.BUNNY_LIBRARY_ID,
    signingKey: process.env.BUNNY_SIGNING_KEY,
    pullZone: process.env.BUNNY_PULL_ZONE, // Optional: for custom domains
}));
