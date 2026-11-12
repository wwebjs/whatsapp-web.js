const { expect } = require('chai');

const {
    Contact,
    BusinessContact,
    PrivateContact,
} = require('../../src/structures');

function createContactData({ userid, user, server }) {
    return {
        id: { _serialized: `${user}@${server}`, user, server },
        userid,
        isBusiness: false,
        isEnterprise: false,
    };
}

describe('Contact number', function () {
    it('keeps userid when present', function () {
        const contact = new Contact(
            {},
            createContactData({
                userid: '1234567890',
                user: '1234567890',
                server: 'c.us',
            }),
        );
        expect(contact.number).to.equal('1234567890');
    });

    it('falls back to the id user for phone-addressed ids', function () {
        const contact = new Contact(
            {},
            createContactData({
                userid: undefined,
                user: '1234567890',
                server: 'c.us',
            }),
        );
        expect(contact.number).to.equal('1234567890');
    });

    it('stays undefined for LID ids without a mapping', function () {
        const contact = new Contact(
            {},
            createContactData({
                userid: undefined,
                user: '987654321098765',
                server: 'lid',
            }),
        );
        expect(contact.number).to.equal(undefined);
    });

    it('stays undefined for group ids', function () {
        const contact = new Contact(
            {},
            createContactData({
                userid: undefined,
                user: '1234567890-1234567890',
                server: 'g.us',
            }),
        );
        expect(contact.number).to.equal(undefined);
    });

    it('applies the same fallback to business contacts', function () {
        const data = createContactData({
            userid: undefined,
            user: '1234567890',
            server: 'c.us',
        });
        data.isBusiness = true;
        const business = new BusinessContact({}, data);
        const priv = new PrivateContact({}, data);
        expect(business.number).to.equal('1234567890');
        expect(priv.number).to.equal('1234567890');
    });
});
