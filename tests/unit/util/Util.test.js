'use strict';

const { expect } = require('chai');

const Util = require('../../../src/util/Util');

describe('Util', function () {
    it('cannot be instantiated', function () {
        expect(() => new Util()).to.throw(/may not be instantiated/);
    });

    describe('generateHash', function () {
        it('returns a string of the requested length', function () {
            expect(Util.generateHash(0)).to.equal('');
            expect(Util.generateHash(6)).to.have.lengthOf(6);
            expect(Util.generateHash(32)).to.have.lengthOf(32);
        });

        it('only uses alphanumeric characters', function () {
            const hash = Util.generateHash(200);
            expect(hash).to.match(/^[A-Za-z0-9]+$/);
        });
    });

    describe('mergeDefault', function () {
        it('returns def when given is falsy', function () {
            const def = { a: 1 };
            expect(Util.mergeDefault(def, undefined)).to.equal(def);
        });

        it('fills in missing keys from def', function () {
            const merged = Util.mergeDefault({ a: 1, b: 2 }, { a: 10 });
            expect(merged).to.deep.equal({ a: 10, b: 2 });
        });

        it('replaces explicit undefined values with the default', function () {
            const merged = Util.mergeDefault({ a: 1 }, { a: undefined });
            expect(merged.a).to.equal(1);
        });

        it('recurses into nested objects', function () {
            const def = { a: { x: 1, y: 2 } };
            const merged = Util.mergeDefault(def, { a: { x: 10 } });
            expect(merged).to.deep.equal({ a: { x: 10, y: 2 } });
        });
    });
});
