'use strict';

const { expect } = require('chai');

const Poll = require('../../../src/structures/Poll');

describe('Poll', function () {
    it('trims whitespace from the poll name', function () {
        const poll = new Poll('   What is your favorite color?   ', [
            'Red',
            'Blue',
        ]);
        expect(poll.pollName).to.equal('What is your favorite color?');
    });

    it('trims each poll option and assigns sequential localIds', function () {
        const poll = new Poll('Q', ['  A ', 'B', ' C']);
        expect(poll.pollOptions).to.deep.equal([
            { name: 'A', localId: 0 },
            { name: 'B', localId: 1 },
            { name: 'C', localId: 2 },
        ]);
    });

    it('defaults allowMultipleAnswers to false', function () {
        const poll = new Poll('Q', ['A', 'B']);
        expect(poll.options.allowMultipleAnswers).to.equal(false);
    });

    it('respects allowMultipleAnswers=true', function () {
        const poll = new Poll('Q', ['A', 'B'], { allowMultipleAnswers: true });
        expect(poll.options.allowMultipleAnswers).to.equal(true);
    });

    it('coerces truthy non-boolean values to false', function () {
        // allowMultipleAnswers must be strictly === true
        const poll = new Poll('Q', ['A', 'B'], { allowMultipleAnswers: 1 });
        expect(poll.options.allowMultipleAnswers).to.equal(false);
    });

    it('passes through the messageSecret', function () {
        const secret = new Array(32).fill(0);
        const poll = new Poll('Q', ['A', 'B'], { messageSecret: secret });
        expect(poll.options.messageSecret).to.equal(secret);
    });
});
