const chai = require('chai');
const Message = require('../src/structures/Message');

const expect = chai.expect;

// Unit test: constructs a Message from a call_log payload and checks that the
// call metadata is exposed. No live session needed.
describe('Message call_log', function () {
    const client = {};

    function build(overrides) {
        return new Message(client, {
            id: {
                id: 'ABCDEF0123456789',
                _serialized: 'false_123@c.us_ABCDEF0123456789',
                fromMe: false,
                remote: '123@c.us',
            },
            type: 'call_log',
            t: 1700000000,
            from: '123@c.us',
            to: '456@c.us',
            ...overrides,
        });
    }

    it('exposes the call outcome, duration and video flag', function () {
        const msg = build({
            callOutcome: 'AcceptedElsewhere',
            callDuration: 0,
            isVideoCall: false,
        });
        expect(msg.type).to.equal('call_log');
        expect(msg.callOutcome).to.equal('AcceptedElsewhere');
        expect(msg.callDuration).to.equal(0);
        expect(msg.isVideoCall).to.equal(false);
    });

    it('reports a completed video call', function () {
        const msg = build({
            callOutcome: 'Completed',
            callDuration: 42,
            isVideoCall: true,
        });
        expect(msg.callOutcome).to.equal('Completed');
        expect(msg.callDuration).to.equal(42);
        expect(msg.isVideoCall).to.equal(true);
    });

    it('does not set call fields on non call_log messages', function () {
        const msg = build({ type: 'chat', body: 'hi' });
        expect(msg.callOutcome).to.equal(undefined);
        expect(msg.callDuration).to.equal(undefined);
        expect(msg.isVideoCall).to.equal(undefined);
    });
});
