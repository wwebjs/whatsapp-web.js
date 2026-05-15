'use strict';

const { expect } = require('chai');

const ChatFactory = require('../../../src/factories/ChatFactory');
const PrivateChat = require('../../../src/structures/PrivateChat');
const GroupChat = require('../../../src/structures/GroupChat');
const Channel = require('../../../src/structures/Channel');

describe('ChatFactory.create', function () {
    const client = {};

    it('returns a GroupChat when data.isGroup is true', function () {
        const chat = ChatFactory.create(client, {
            isGroup: true,
            groupMetadata: {},
        });
        expect(chat).to.be.instanceOf(GroupChat);
    });

    it('returns a Channel when data.isChannel is true', function () {
        const chat = ChatFactory.create(client, {
            isChannel: true,
            channelMetadata: {},
        });
        expect(chat).to.be.instanceOf(Channel);
    });

    it('returns a PrivateChat otherwise', function () {
        const chat = ChatFactory.create(client, {});
        expect(chat).to.be.instanceOf(PrivateChat);
    });

    it('prefers GroupChat over Channel when both flags are present', function () {
        const chat = ChatFactory.create(client, {
            isGroup: true,
            isChannel: true,
            groupMetadata: {},
        });
        expect(chat).to.be.instanceOf(GroupChat);
    });
});
