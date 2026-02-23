
require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('--- Verifying JaaS JWT Generation (Hardcoded Key) ---');

const appId = process.env.JAAS_APP_ID;
const apiKey = process.env.JAAS_API_KEY;

// Hardcoded key to verify content validity
const formattedPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCCV3/ov6wFDmL6
RY8GEytxMlZgJtwitSvvf0PGfJcDPYKNyjD31lMdG+I/9/LarjkjiVQsU1lOUbr9
+ATEzOq1Hs+K0pFHkXhRL6KTrg424n/i05rOpiEEOWX5C6jmrbu1LxQVvl2g0lm9
qO8vz0LnzpGDGUJJBRfRE3IIz7LCSsTXn2ZguFCXtXPluSu5cdjTIxEAIvV9gwt8
l+6B7VCr81HVYcJ5PV7UpnfUh4da6gm2wt78vmdojNdqnVmXD4vcV5T2tIgDwlxN
2elboOmm+M6+045MmtMN/WgjcK4eeMB253R2gKaKdgHYOzE4SK5FYBx2Tjy1mrm0
fMTYcFE3AgMBAAECggEAMp8jGVUfzRLqVAMh6h0V2S/QpiVRh9VPTAPkYblPuT1x
b/ogDJFb1ElZFLkKw+24WVnjrBdu7uEFO8/QolJnsZJWzra7H82aqgVTIgIOmThc
rM68KBgTaJ2WQiRKI9VDurmfFlbJ7ETl/6gVxT684GS01PLBcLSerF/eARgReC2d
3PY8RpW3+ZdGXqS+d7r47c2w6EoYqw4vnUUwxJ4YnhpDJbO+wG3hxh0zof/MaeA5
lVdaLZv+Jdwexdnbr+MdhSOkpMCUSVEepAxcQjVzUgujGhSmGYyUXOieyPAp1+IO
+v3Y+wVg3pHhTzoa7jQJich3ZlLNVCG5Fs+Atv5dYQKBgQC6QE6tsKqoAIrGxIs1
RN3zXw4p6bwlyNNQVOnhIZUNHNuPZhC14vRcmr1nTz0HgliyGUykb1r4WKzj1MdB
DTFdC2Vdn4ZNf08aYLvh+PA3xB6ef+AejjTjfS+TP0ZdMtYK5IZMPYIGra/I08TZ
8ynGuGU1JgUL3c4jZnZI19iX0QKBgQCzJzh9a08ErRmji56eVapy/5tMG5dkBqYH
VoAtrwxOLY3OCrXAvWIkFzixvpNdGYY73r9SwGtzymc40CemFXi0w0apyzbywaCg
483GYvb2i6HDUsHUcKKGS9kmUC+ji1+yIayPdOzX7MIzaggGn7OAFqFl1QvU+eJm
cdMx0kaihwKBgEqI/7OMts7i4Kao8xjPRY9mo/FsA4qPctl8EdixqseDm+4oJ1nS
yH3iwxd7422E4V/stfo8QgiO3CmU9mR3FiEpNVihRYrv/sUMn0PQbrmyd5pwjE1O
FaZQa+CeetdDR9s2FvSdzNJFYcqZzPZ31GkdVAtP+scD7cHG+GEwWBJxAoGAUmeq
+z2dxhfdIDX7ivb6hRT/mN1kIHVSbzOhl+HZtigL/wc8HOC/wLwRruhrHjq8XNOT
i3vIsSUbn61XX3Sm5fagjT9VEgpwWTEPmL4yvKrziEWLtKzuhPlkc9QUZZSZOvV0
SzRMMPHNThrqgCl7RmKicJWzcI5UTizzKQqAxQcCgYEAs5O4KDQD0zya5jfIpWHe
XbCUEZUVXyT2E3zR+3895sKg57+/+L+DnU/w7iDM2ppfKXeqQokwwB7I6EdY0/5h
YYU/nyaf6wrVKC1pESsH9Vnw8rQnx4llvCiWiLqLs1RaPdSZwYOOviZZ2yqT+tgO
4p3/co5KHLv+avYGAMm/XnY=
-----END PRIVATE KEY-----`;

console.log('App ID:', appId ? 'Present' : 'Missing');
console.log('API Key:', apiKey ? 'Present' : 'Missing');
console.log('Private Key Length:', formattedPrivateKey.length);

if (!appId || !apiKey) {
    console.error('ERROR: Missing environment variables (AppID/APIKey).');
    process.exit(1);
}

try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        aud: 'jitsi',
        iss: 'chat',
        sub: appId,
        room: 'test-room',
        exp: now + 7200,
        nbf: now - 10,
        context: {
            user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
                moderator: true,
            },
            features: {
                recording: true,
            },
            room: {
                lobby_bypass: true,
            },
        },
    };

    const token = jwt.sign(payload, formattedPrivateKey, {
        algorithm: 'RS256',
        header: {
            alg: 'RS256',
            typ: 'JWT',
            kid: apiKey,
        },
    });

    console.log('\nSUCCESS: JWT Generated Successfully!');
    console.log('Token Preview:', token.substring(0, 50) + '...');

    console.log('\n--- GLODEN BASE64 KEY FOR .ENV ---');
    console.log(Buffer.from(formattedPrivateKey, 'utf-8').toString('base64'));
    console.log('----------------------------------');
} catch (error) {
    console.error('\nERROR: Failed to generate JWT');
    console.error(error.message);
}
