
const fs = require('fs');

// The original key content provided by the user, preserving newlines EXACTLY as they appear in the PEM format.
const key = `-----BEGIN PRIVATE KEY-----
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

// Correctly encode to Base64
// We verify it immediately by trying to decode and check regex
const base64 = Buffer.from(key, 'utf-8').toString('base64');
console.log(base64);

// Additional check: when decoded, does it still look like a key?
const decoded = Buffer.from(base64, 'base64').toString('utf-8');
if (decoded.includes('-----BEGIN PRIVATE KEY-----') && decoded.includes('\n')) {
    // console.log("Key format preserved correctly with newlines");
} else {
    console.error("WARNING: Newlines might be lost");
}
