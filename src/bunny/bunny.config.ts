import { registerAs } from '@nestjs/config';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
        return defaultValue;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
        return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
        return false;
    }

    return defaultValue;
}

function parseRolloutPercentage(value: string | undefined, defaultValue = 0): number {
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return defaultValue;
    }

    return Math.max(0, Math.min(100, Math.floor(parsed)));
}

export default registerAs('bunny', () => {
    const useUnifiedService = parseBoolean(process.env.BUNNY_USE_UNIFIED_SERVICE, false);
    const unifiedRolloutPercentage = parseRolloutPercentage(
        process.env.BUNNY_UNIFIED_ROLLOUT_PERCENTAGE,
        0,
    );

    return {
        apiKey: process.env.BUNNY_API_KEY,
        libraryId: process.env.BUNNY_LIBRARY_ID,
        signingKey: process.env.BUNNY_SIGNING_KEY,
        pullZone: process.env.BUNNY_PULL_ZONE,

        migration: {
            useUnifiedService,
            unifiedRolloutPercentage,
        },
    };
});