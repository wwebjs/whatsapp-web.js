'use strict';

const { expect } = require('chai');

const Buttons = require('../../../src/structures/Buttons');
const MessageMedia = require('../../../src/structures/MessageMedia');

describe('Buttons', function () {
    it('formats provided buttons keeping the custom id when present', function () {
        const buttons = new Buttons(
            'pick one',
            [{ id: 'yes', body: 'Yes' }, { body: 'No' }],
            'Question',
            'Footer',
        );

        expect(buttons.type).to.equal('chat');
        expect(buttons.title).to.equal('Question');
        expect(buttons.footer).to.equal('Footer');
        expect(buttons.buttons).to.have.lengthOf(2);
        expect(buttons.buttons[0]).to.deep.equal({
            buttonId: 'yes',
            buttonText: { displayText: 'Yes' },
            type: 1,
        });
        expect(buttons.buttons[1].buttonText).to.deep.equal({
            displayText: 'No',
        });
        expect(buttons.buttons[1].buttonId).to.be.a('string').with.length(6);
    });

    it('caps the buttons array at 3 entries', function () {
        const buttons = new Buttons('body', [
            { body: 'A' },
            { body: 'B' },
            { body: 'C' },
            { body: 'D' },
        ]);

        expect(buttons.buttons).to.have.lengthOf(3);
        expect(
            buttons.buttons.map((b) => b.buttonText.displayText),
        ).to.deep.equal(['A', 'B', 'C']);
    });

    it('throws when no buttons are provided', function () {
        expect(() => new Buttons('body', [])).to.throw();
    });

    it('treats a MessageMedia body as a media-type button message', function () {
        const media = new MessageMedia('image/png', 'AAAA');
        const buttons = new Buttons(media, [{ body: 'A' }], 'ignored', 'foot');

        expect(buttons.type).to.equal('media');
        expect(buttons.title).to.equal('');
        expect(buttons.footer).to.equal('foot');
    });
});
