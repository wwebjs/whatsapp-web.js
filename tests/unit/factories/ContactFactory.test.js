'use strict';

const { expect } = require('chai');

const ContactFactory = require('../../../src/factories/ContactFactory');
const PrivateContact = require('../../../src/structures/PrivateContact');
const BusinessContact = require('../../../src/structures/BusinessContact');

describe('ContactFactory.create', function () {
    const client = {};

    it('returns a BusinessContact when data.isBusiness is true', function () {
        const contact = ContactFactory.create(client, { isBusiness: true });
        expect(contact).to.be.instanceOf(BusinessContact);
    });

    it('returns a PrivateContact otherwise', function () {
        const contact = ContactFactory.create(client, { isBusiness: false });
        expect(contact).to.be.instanceOf(PrivateContact);
    });

    it('treats missing isBusiness as private', function () {
        const contact = ContactFactory.create(client, {});
        expect(contact).to.be.instanceOf(PrivateContact);
    });
});
