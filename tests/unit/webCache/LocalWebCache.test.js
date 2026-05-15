'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');

const LocalWebCache = require('../../../src/webCache/LocalWebCache');
const { VersionResolveError } = require('../../../src/webCache/WebCache');

describe('LocalWebCache', function () {
    let tempDir;

    beforeEach(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wwebjs-cache-'));
    });

    afterEach(function () {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('persists and resolves a cached version', async function () {
        const cache = new LocalWebCache({ path: tempDir });
        await cache.persist('<html>1</html>', '2.3000.1');

        const resolved = await cache.resolve('2.3000.1');
        expect(resolved).to.equal('<html>1</html>');
    });

    it('resolves to null when the version is missing and strict is false', async function () {
        const cache = new LocalWebCache({ path: tempDir });
        expect(await cache.resolve('missing')).to.equal(null);
    });

    it('throws VersionResolveError when strict and the version is missing', async function () {
        const cache = new LocalWebCache({ path: tempDir, strict: true });
        let err;
        try {
            await cache.resolve('missing');
        } catch (e) {
            err = e;
        }
        expect(err).to.be.instanceOf(VersionResolveError);
    });

    it('creates the cache directory if it does not exist', async function () {
        const nested = path.join(tempDir, 'new', 'nested');
        const cache = new LocalWebCache({ path: nested });
        await cache.persist('<html></html>', '1.0.0');
        expect(fs.existsSync(path.join(nested, '1.0.0.html'))).to.equal(true);
    });
});
