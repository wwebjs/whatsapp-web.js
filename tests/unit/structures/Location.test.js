'use strict';

const { expect } = require('chai');

const Location = require('../../../src/structures/Location');

describe('Location', function () {
    it('stores latitude and longitude', function () {
        const loc = new Location(37.422, -122.084);
        expect(loc.latitude).to.equal(37.422);
        expect(loc.longitude).to.equal(-122.084);
    });

    it('leaves optional fields undefined when no options are passed', function () {
        const loc = new Location(0, 0);
        expect(loc.name).to.equal(undefined);
        expect(loc.address).to.equal(undefined);
        expect(loc.url).to.equal(undefined);
    });

    it('exposes name/address/url from the options object', function () {
        const loc = new Location(1, 2, {
            name: 'Googleplex',
            address: '1600 Amphitheatre Pkwy',
            url: 'https://example.com',
        });
        expect(loc.name).to.equal('Googleplex');
        expect(loc.address).to.equal('1600 Amphitheatre Pkwy');
        expect(loc.url).to.equal('https://example.com');
    });

    describe('description', function () {
        it('joins name and address with a newline when both are present', function () {
            const loc = new Location(1, 2, {
                name: 'Googleplex',
                address: '1600 Amphitheatre Pkwy',
            });
            expect(loc.description).to.equal(
                'Googleplex\n1600 Amphitheatre Pkwy',
            );
        });

        it('uses name only when address is missing', function () {
            const loc = new Location(1, 2, { name: 'Googleplex' });
            expect(loc.description).to.equal('Googleplex');
        });

        it('uses address only when name is missing', function () {
            const loc = new Location(1, 2, { address: 'somewhere' });
            expect(loc.description).to.equal('somewhere');
        });

        it('falls back to an empty string when neither is provided', function () {
            const loc = new Location(1, 2);
            expect(loc.description).to.equal('');
        });
    });
});
