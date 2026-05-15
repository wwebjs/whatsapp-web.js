const { expect } = require('chai');
const sinon = require('sinon');

const helper = require('../helper');
const { Contact, Chat } = require('../../src/structures');

const remoteId = helper.remoteId;

describe('Message', function () {
    let client;
    let chat;
    let message;

    before(async function () {
        this.timeout(35000);
        client = helper.createClient({ authenticated: true });
        await client.initialize();

        chat = await client.getChatById(remoteId);
        message = await chat.sendMessage('this is only a test');

        // wait for message to be sent
        await helper.sleep(1000);
    });

    after(async function () {
        await client.destroy();
    });

    it('can get the related chat', async function () {
        const chat = await message.getChat();
        expect(chat).to.be.instanceOf(Chat);
        expect(chat.id._serialized).to.equal(remoteId);
    });

    it('can get the related contact', async function () {
        const contact = await message.getContact();
        expect(contact).to.be.instanceOf(Contact);
        expect(contact.id._serialized).to.equal(client.info.wid._serialized);
    });

    it('can get message info', async function () {
        const info = await message.getInfo();
        expect(typeof info).to.equal('object');
        expect(Array.isArray(info.played)).to.equal(true);
        expect(Array.isArray(info.read)).to.equal(true);
        expect(Array.isArray(info.delivery)).to.equal(true);
    });

    describe('Replies', function () {
        let replyMsg;

        it('can reply to a message', async function () {
            replyMsg = await message.reply('this is my reply');
            expect(replyMsg.hasQuotedMsg).to.equal(true);
        });

        it('can get the quoted message', async function () {
            const quotedMsg = await replyMsg.getQuotedMessage();
            expect(quotedMsg.id._serialized).to.equal(message.id._serialized);
        });
    });

    describe('Star', function () {
        it('can star a message', async function () {
            expect(message.isStarred).to.equal(false);
            await message.star();

            await helper.sleep(1000);

            // reload and check
            await message.reload();
            expect(message.isStarred).to.equal(true);
        });

        it('can un-star a message', async function () {
            expect(message.isStarred).to.equal(true);
            await message.unstar();

            await helper.sleep(1000);

            // reload and check
            await message.reload();
            expect(message.isStarred).to.equal(false);
        });
    });

    describe('Delete', function () {
        it('can delete a message for me', async function () {
            await message.delete();

            await helper.sleep(5000);
            expect(await message.reload()).to.equal(null);
        });

        it('can delete a message for everyone', async function () {
            message = await chat.sendMessage('sneaky message');
            await helper.sleep(1000);

            const callback = sinon.spy();
            client.once('message_revoke_everyone', callback);

            await message.delete(true);
            await helper.sleep(1000);

            expect(await message.reload()).to.equal(null);
            expect(callback.called).to.equal(true);
            const [revokeMsg, originalMsg] = callback.args[0];
            expect(revokeMsg.id._serialized).to.equal(
                originalMsg.id._serialized,
            );
            expect(originalMsg.body).to.equal('sneaky message');
            expect(originalMsg.type).to.equal('chat');
            expect(revokeMsg.body).to.equal('');
            expect(revokeMsg.type).to.equal('revoked');
        });
    });
});
