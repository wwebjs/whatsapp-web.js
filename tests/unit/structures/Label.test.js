'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const Label = require('../../../src/structures/Label');

describe('Label', function () {
    it('patches id, name and hexColor from labelData', function () {
        const label = new Label(
            {},
            {
                id: '1',
                name: 'Important',
                hexColor: '#ff0000',
            },
        );
        expect(label.id).to.equal('1');
        expect(label.name).to.equal('Important');
        expect(label.hexColor).to.equal('#ff0000');
    });

    it('skips patching when labelData is omitted', function () {
        const label = new Label({});
        expect(label.id).to.equal(undefined);
        expect(label.name).to.equal(undefined);
        expect(label.hexColor).to.equal(undefined);
    });

    it('delegates getChats() to the client', async function () {
        const expected = [{ id: 'chat-1' }];
        const client = {
            getChatsByLabelId: sinon.stub().resolves(expected),
        };
        const label = new Label(client, {
            id: '42',
            name: 'x',
            hexColor: '#0',
        });

        const chats = await label.getChats();

        expect(chats).to.equal(expected);
        expect(client.getChatsByLabelId.calledOnceWithExactly('42')).to.equal(
            true,
        );
    });
});
