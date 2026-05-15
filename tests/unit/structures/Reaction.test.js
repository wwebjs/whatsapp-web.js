'use strict';

const { expect } = require('chai');

const Reaction = require('../../../src/structures/Reaction');

describe('Reaction', function () {
    it('maps raw reaction data to instance fields', function () {
        const data = {
            msgKey: { id: 'r1', _serialized: 'reaction-1' },
            parentMsgKey: { id: 'm1', _serialized: 'message-1' },
            orphan: 0,
            orphanReason: null,
            timestamp: 1234567890,
            reactionText: '🔥',
            read: true,
            senderUserJid: '15551234567@c.us',
            ack: 2,
        };

        const reaction = new Reaction({}, data);

        expect(reaction.id).to.deep.equal(data.msgKey);
        expect(reaction.msgId).to.deep.equal(data.parentMsgKey);
        expect(reaction.orphan).to.equal(0);
        expect(reaction.orphanReason).to.equal(null);
        expect(reaction.timestamp).to.equal(1234567890);
        expect(reaction.reaction).to.equal('🔥');
        expect(reaction.read).to.equal(true);
        expect(reaction.senderId).to.equal('15551234567@c.us');
        expect(reaction.ack).to.equal(2);
    });

    it('does not patch when data is omitted', function () {
        const reaction = new Reaction({});
        expect(reaction.reaction).to.equal(undefined);
        expect(reaction.timestamp).to.equal(undefined);
    });
});
