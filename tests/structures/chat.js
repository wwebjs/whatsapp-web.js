const { expect } = require('chai');

const helper = require('../helper');
const Message = require('../../src/structures/Message');
const { MessageTypes } = require('../../src/util/Constants');
const { Contact } = require('../../src/structures');

const remoteId = helper.remoteId;

describe('Chat', function () {
    let client;
    let chat;

    before(async function () {
        this.timeout(35000);
        client = helper.createClient({ authenticated: true });
        await client.initialize();
        chat = await client.getChatById(remoteId);
    });

    after(async function () {
        await client.destroy();
    });

    it('can send a message to a chat', async function () {
        const msg = await chat.sendMessage('hello world');
        expect(msg).to.be.instanceOf(Message);
        expect(msg.type).to.equal(MessageTypes.TEXT);
        expect(msg.fromMe).to.equal(true);
        expect(msg.body).to.equal('hello world');
        expect(msg.to).to.equal(remoteId);
    });

    it('can fetch messages sent in a chat', async function () {
        await helper.sleep(1000);
        const msg = await chat.sendMessage('another message');
        await helper.sleep(500);

        const messages = await chat.fetchMessages();
        expect(messages.length).to.be.greaterThanOrEqual(2);

        const fetchedMsg = messages[messages.length - 1];
        expect(fetchedMsg).to.be.instanceOf(Message);
        expect(fetchedMsg.type).to.equal(MessageTypes.TEXT);
        expect(fetchedMsg.id._serialized).to.equal(msg.id._serialized);
        expect(fetchedMsg.body).to.equal(msg.body);
    });

    it('can use a limit when fetching messages sent in a chat', async function () {
        await helper.sleep(1000);
        const msg = await chat.sendMessage('yet another message');
        await helper.sleep(500);

        const messages = await chat.fetchMessages({ limit: 1 });
        expect(messages).to.have.lengthOf(1);

        const fetchedMsg = messages[0];
        expect(fetchedMsg).to.be.instanceOf(Message);
        expect(fetchedMsg.type).to.equal(MessageTypes.TEXT);
        expect(fetchedMsg.id._serialized).to.equal(msg.id._serialized);
        expect(fetchedMsg.body).to.equal(msg.body);
    });

    it('can use fromMe=true when fetching messages sent in a chat to get only bot messages', async function () {
        const messages = await chat.fetchMessages({ fromMe: true });
        expect(messages).to.have.lengthOf(2);
    });

    it('can use fromMe=false when fetching messages sent in a chat to get only non bot messages', async function () {
        const messages = await chat.fetchMessages({ fromMe: false });
        expect(messages).to.have.lengthOf(0);
    });

    it('can get the related contact', async function () {
        const contact = await chat.getContact();
        expect(contact).to.be.instanceOf(Contact);
        expect(contact.id._serialized).to.equal(chat.id._serialized);
    });

    describe('Seen', function () {
        it('can mark a chat as unread', async function () {
            await chat.markUnread();
            await helper.sleep(500);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.unreadCount).to.equal(-1);
        });

        it('can mark a chat as seen', async function () {
            const res = await chat.sendSeen();
            expect(res).to.equal(true);

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.unreadCount).to.equal(0);
        });
    });

    describe('Archiving', function () {
        it('can archive a chat', async function () {
            const res = await chat.archive();
            expect(res).to.equal(true);

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.archived).to.equal(true);
        });

        it('can unarchive a chat', async function () {
            const res = await chat.unarchive();
            expect(res).to.equal(false);

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.archived).to.equal(false);
        });
    });

    describe('Pinning', function () {
        it('can pin a chat', async function () {
            const res = await chat.pin();
            expect(res).to.equal(true);

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.pinned).to.equal(true);
        });

        it('can unpin a chat', async function () {
            const res = await chat.unpin();
            expect(res).to.equal(false);
            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.pinned).to.equal(false);
        });
    });

    describe('Muting', function () {
        it('can mute a chat forever', async function () {
            await chat.mute();

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.isMuted).to.equal(true);
            expect(chat.muteExpiration).to.equal(-1);
        });

        it('can mute a chat until a specific date', async function () {
            const unmuteDate = new Date(new Date().getTime() + 1000 * 60 * 60);
            await chat.mute(unmuteDate);

            await helper.sleep(1000);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.isMuted).to.equal(true);
            expect(chat.muteExpiration).to.equal(
                Math.round(unmuteDate.getTime() / 1000),
            );
        });

        it('can unmute a chat', async function () {
            await chat.unmute();
            await helper.sleep(500);

            // refresh chat
            chat = await client.getChatById(remoteId);
            expect(chat.isMuted).to.equal(false);
            expect(chat.muteExpiration).to.equal(0);
        });
    });

    // eslint-disable-next-line mocha/no-pending-tests
    describe.skip('Destructive operations', function () {
        it('can clear all messages from chat', async function () {
            const res = await chat.clearMessages();
            expect(res).to.equal(true);

            await helper.sleep(3000);

            const msgs = await chat.fetchMessages();
            expect(msgs).to.have.lengthOf(0);
        });

        it('can delete a chat', async function () {
            const res = await chat.delete();
            expect(res).to.equal(true);
        });
    });
});
