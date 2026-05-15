'use strict';

const { expect } = require('chai');

const {
    WebCache,
    VersionResolveError,
} = require('../../../src/webCache/WebCache');

describe('WebCache', function () {
    it('resolve() returns null', async function () {
        expect(await new WebCache().resolve('1.2.3')).to.equal(null);
    });

    it('persist() resolves without error', async function () {
        await new WebCache().persist('<html></html>', '1.2.3');
    });

    it('exports VersionResolveError as an Error subclass', function () {
        const err = new VersionResolveError('boom');
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('boom');
    });
});
