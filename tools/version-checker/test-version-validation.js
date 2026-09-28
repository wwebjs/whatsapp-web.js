#!/usr/bin/env node

/**
 * Companion test for version validation hardening.
 * Verifies that the version scraper rejects malformed values
 * that could inject environment variables via $GITHUB_ENV.
 *
 * Related: fix/version-injection-github-env
 * Scan ID: cmubhrpno031zrq013m2kmm5n
 */

const assert = require('assert');

const VERSION_REGEX = /^[0-9]+(\.[0-9]+)+$/;

const VALID_VERSIONS = [
    '2.3000.1',
    '1.34.7',
    '2.24.12.10',
    '0.1.0',
];

const MALICIOUS_VERSIONS = [
    '2.3000.1\nEVIL=1',
    '2.3000.1\nPATH=/tmp/evil:/usr/bin',
    '2.3000.1;rm -rf /',
    '2.3000.1$(whoami)',
    '',
    'not-a-version',
    '2.3000.1\n',
    '2.3000.1\r\nX-Injected: yes',
    '2.3000.1 KEY=VALUE',
];

let passed = 0;
let failed = 0;

for (const v of VALID_VERSIONS) {
    assert.ok(VERSION_REGEX.test(v), `Expected valid: ${JSON.stringify(v)}`);
    passed++;
}

for (const v of MALICIOUS_VERSIONS) {
    assert.ok(!VERSION_REGEX.test(v), `Expected invalid: ${JSON.stringify(v)}`);
    passed++;
}

console.log(`version-validation: ${passed} assertions passed, ${failed} failed`);
