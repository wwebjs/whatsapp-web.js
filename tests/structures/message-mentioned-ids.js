const { expect } = require('chai');

const { Message } = require('../../src/structures');

function createMessageData(mentionedJidList) {
    return {
        id: { _serialized: 'true_1234567890@c.us_ABCDEF123456', fromMe: false },
        ack: 1,
        body: 'hello @user',
        type: 'chat',
        t: 1234567890,
        from: '1234567890@c.us',
        to: '1234567890@c.us',
        mentionedJidList,
    };
}

describe('Message mentionedIds', function () {
    it('keeps string mention ids as-is', function () {
        const message = new Message(
            {},
            createMessageData(['1234567890@c.us', '0987654321@c.us']),
        );
        expect(message.mentionedIds).to.deep.equal([
            '1234567890@c.us',
            '0987654321@c.us',
        ]);
    });

    it('normalizes serialized Wid objects to strings (quoted messages)', function () {
        const message = new Message(
            {},
            createMessageData([
                {
                    server: 'c.us',
                    user: '1234567890',
                    _serialized: '1234567890@c.us',
                },
                { server: 'c.us', user: '0987654321', $1: '0987654321@c.us' },
            ]),
        );
        expect(message.mentionedIds).to.deep.equal([
            '1234567890@c.us',
            '0987654321@c.us',
        ]);
    });

    it('defaults to an empty array when absent', function () {
        const data = createMessageData(undefined);
        delete data.mentionedJidList;
        const message = new Message({}, data);
        expect(message.mentionedIds).to.deep.equal([]);
    });

    it('getMentions resolves the normalized ids', async function () {
        const client = {
            getContactById: async (id) => ({ id: { _serialized: id } }),
        };
        const message = new Message(
            client,
            createMessageData([
                {
                    server: 'c.us',
                    user: '1234567890',
                    _serialized: '1234567890@c.us',
                },
            ]),
        );
        const mentions = await message.getMentions();
        expect(mentions).to.have.lengthOf(1);
        expect(mentions[0].id._serialized).to.equal('1234567890@c.us');
    });
});
