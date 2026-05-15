'use strict';

const { expect } = require('chai');

const RemoteWebCache = require('../../../src/webCache/RemoteWebCache');

describe('RemoteWebCache', function () {
    it('throws when remotePath is missing', function () {
        expect(() => new RemoteWebCache()).to.throw(/remotePath is required/);
        expect(() => new RemoteWebCache({})).to.throw(/remotePath is required/);
    });

    it('stores remotePath and defaults strict to false', function () {
        const cache = new RemoteWebCache({
            remotePath: 'https://example.com/{version}.html',
        });
        expect(cache.remotePath).to.equal('https://example.com/{version}.html');
        expect(cache.strict).to.equal(false);
    });

    it('respects strict=true', function () {
        const cache = new RemoteWebCache({
            remotePath: 'https://example.com/{version}.html',
            strict: true,
        });
        expect(cache.strict).to.equal(true);
    });

    it('persist() is a no-op', async function () {
        const cache = new RemoteWebCache({
            remotePath: 'https://example.com/{version}.html',
        });
        // Should resolve without error and return undefined
        const result = await cache.persist('<html></html>', '1.0.0');
        expect(result).to.equal(undefined);
    });
});
