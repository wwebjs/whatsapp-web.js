'use strict';

const { expect } = require('chai');

const { createWebCache } = require('../../../src/webCache/WebCacheFactory');
const LocalWebCache = require('../../../src/webCache/LocalWebCache');
const RemoteWebCache = require('../../../src/webCache/RemoteWebCache');
const { WebCache } = require('../../../src/webCache/WebCache');

describe('WebCacheFactory.createWebCache', function () {
    it('returns a LocalWebCache for type=local', function () {
        const cache = createWebCache('local', {});
        expect(cache).to.be.instanceOf(LocalWebCache);
    });

    it('returns a RemoteWebCache for type=remote', function () {
        const cache = createWebCache('remote', {
            remotePath: 'https://example.com/{version}.html',
        });
        expect(cache).to.be.instanceOf(RemoteWebCache);
    });

    it('returns a no-op WebCache for type=none', function () {
        const cache = createWebCache('none');
        expect(cache).to.be.instanceOf(WebCache);
    });

    it('throws on unknown types', function () {
        expect(() => createWebCache('unknown')).to.throw(
            /Invalid WebCache type/,
        );
    });
});
