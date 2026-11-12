'use strict';

const chai = require('chai');
const sinon = require('sinon');
const vm = require('vm');
const { LoadUtils } = require('../src/util/Injected/Utils');

chai.use(require('chai-as-promised'));
const expect = chai.expect;

// Run the actual injected code against the observed WhatsApp call model.
// These tests need no browser, login, or external call participants.
describe('Injected call controls', function () {
    let sandbox;
    let clock;
    let collection;
    let modules;
    let api;
    let outgoing;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();
        outgoing = {
            id: 'outgoing-call',
            peerJid: { $1: 'peer@lid' },
            outgoing: true,
            isVideo: false,
            isGroup: false,
            getState: () => 1,
        };
        collection = {
            activeCall: null,
            lastActiveCall: null,
            pendingOutgoingCall: null,
            isInConnectedCall: false,
            // Collection.get is an ID lookup, not a singleton accessor.
            get: sandbox.stub().returns(undefined),
        };
        modules = {
            WAWebCallCollection: collection,
            WAWebWidFactory: {
                createWid: (id) => ({
                    _serialized: id,
                    isGroup: () => id.endsWith('@g.us'),
                }),
            },
            WAWebUserPrefsMeUser: {
                isMeAccount: (wid) => wid._serialized === 'self@c.us',
            },
            WAWebQueryExistsJob: {
                queryPhoneExists: sandbox.stub().resolves(null),
            },
            WAWebWamEnumCallFromUi: { CALL_FROM_UI: { CONVERSATION: 7 } },
            WAWebWamEnumLobbyEntryPointType: {
                LOBBY_ENTRY_POINT_TYPE: { NOT_OPENED: 9 },
            },
            WAWebVoipStartCall: {
                startWAWebVoipCall: sandbox.stub().callsFake(async () => {
                    collection.activeCall = outgoing;
                    return true;
                }),
                startWAWebVoipGroupCallFromWids: sandbox
                    .stub()
                    .callsFake(async () => {
                        collection.activeCall = { ...outgoing, isGroup: true };
                    }),
            },
        };
        const context = vm.createContext({
            window: {
                require: (name) => {
                    if (!(name in modules))
                        throw new Error('Unknown module: ' + name);
                    return modules[name];
                },
            },
            Date,
            setTimeout,
        });
        vm.runInContext('(' + LoadUtils.toString() + ')()', context);
        api = context.window.WWebJS;
        sandbox.stub(api, 'setupCallMediaStream').callsFake(() => {
            api._callMediaActive = true;
        });
        sandbox.stub(api, 'teardownCallMediaStream').callsFake(() => {
            api._callMediaActive = false;
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('reads the current call instead of failure history', function () {
        collection.activeCall = outgoing;
        collection.lastActiveCall = { ...outgoing, id: 'old-failed-call' };
        expect(api.getOngoingCall()).to.equal(outgoing);
        expect(api.getActiveCall().id).to.equal('outgoing-call');
        expect(api.getActiveCall().peerJid).to.equal('peer@lid');
    });

    it('does not report a historical call when there is no active call', function () {
        collection.lastActiveCall = outgoing;
        expect(api.getOngoingCall()).to.equal(null);
        expect(api.getActiveCall()).to.equal(null);
    });

    it('does not report an ended active model', function () {
        collection.activeCall = { ...outgoing, getState: () => 0 };
        expect(api.getOngoingCall()).to.equal(null);
    });

    it('checks connectivity against the current call ID', function () {
        collection.activeCall = outgoing;
        collection.isInConnectedCall = true;
        expect(api.isCallConnected('outgoing-call')).to.equal(true);
        expect(api.isCallConnected('old-call')).to.equal(false);
        collection.activeCall = null;
        collection.lastActiveCall = outgoing;
        expect(api.isCallConnected('outgoing-call')).to.equal(false);
    });

    it('waits for the outgoing active model and serializes its complete data', async function () {
        const controller = modules.WAWebVoipStartCall.startWAWebVoipCall;
        controller.callsFake(async () => {
            setTimeout(() => {
                collection.activeCall = outgoing;
            }, 400);
            return true;
        });
        const promise = api.startCall('peer@c.us', false, false, 1000, false);
        await clock.tickAsync(500);
        const call = await promise;
        expect(call.id).to.equal('outgoing-call');
        expect(call.peerJid).to.equal('peer@lid');
        expect(call.outgoing).to.equal(true);
        expect(controller.firstCall.args.slice(1)).to.deep.equal([
            false,
            7,
            9,
            null,
            { entryTrust: 'user_gesture' },
        ]);
        expect(api.setupCallMediaStream.called).to.equal(false);
    });

    it('rejects a declined start and releases its synthetic microphone', async function () {
        modules.WAWebVoipStartCall.startWAWebVoipCall.resolves(false);
        const assertion = expect(api.startCall('peer@c.us')).to.be.rejectedWith(
            'declined to start',
        );
        await clock.tickAsync(5100);
        await assertion;
        expect(api._callMediaActive).to.equal(false);
    });

    it('rejects when no outgoing active model appears', async function () {
        collection.lastActiveCall = outgoing;
        modules.WAWebVoipStartCall.startWAWebVoipCall.resolves(true);
        const assertion = expect(api.startCall('peer@c.us')).to.be.rejectedWith(
            'not promoted to an active call',
        );
        await clock.tickAsync(5100);
        await assertion;
        expect(api._callMediaActive).to.equal(false);
    });

    it('does not mistake an incoming call for the requested outgoing call', async function () {
        modules.WAWebVoipStartCall.startWAWebVoipCall.callsFake(async () => {
            collection.activeCall = { ...outgoing, outgoing: false };
            return true;
        });
        const assertion = expect(api.startCall('peer@c.us')).to.be.rejectedWith(
            'not promoted to an active call',
        );
        await clock.tickAsync(5100);
        await assertion;
    });

    it('rejects a second start without changing an active call microphone', async function () {
        collection.activeCall = outgoing;
        api._callMediaActive = true;
        await expect(
            api.startCall('peer@c.us', false, false, 1000, false),
        ).to.be.rejectedWith('already active or being started');
        expect(modules.WAWebVoipStartCall.startWAWebVoipCall.called).to.equal(
            false,
        );
        expect(api.teardownCallMediaStream.called).to.equal(false);
        expect(api._callMediaActive).to.equal(true);
    });

    it('rejects a start while WhatsApp is already preparing one', async function () {
        collection.pendingOutgoingCall = {};
        await expect(api.startCall('peer@c.us')).to.be.rejectedWith(
            'already active or being started',
        );
        expect(api.setupCallMediaStream.called).to.equal(false);
    });

    it('rejects calling the signed-in account before starting media', async function () {
        await expect(api.startCall('self@c.us')).to.be.rejectedWith(
            'own WhatsApp account',
        );
        expect(modules.WAWebVoipStartCall.startWAWebVoipCall.called).to.equal(
            false,
        );
        expect(api.setupCallMediaStream.called).to.equal(false);
    });

    it('restores normal microphone capture after an earlier injected attempt', async function () {
        api._callMediaActive = true;
        const promise = api.startCall('peer@c.us', false, false, 1000, false);
        await clock.tickAsync(100);
        await promise;
        expect(api._callMediaActive).to.equal(false);
    });

    it('preserves controller exceptions and cleans up abandoned injection', async function () {
        modules.WAWebVoipStartCall.startWAWebVoipCall.rejects(
            new Error('VoIP init failed'),
        );
        await expect(api.startCall('peer@c.us')).to.be.rejectedWith(
            'VoIP init failed',
        );
        expect(api._callMediaActive).to.equal(false);
    });

    it('does not change capture if another call arrives during phone lookup', async function () {
        modules.WAWebQueryExistsJob.queryPhoneExists.callsFake(async () => {
            collection.activeCall = { ...outgoing, outgoing: false };
            return { wid: modules.WAWebWidFactory.createWid('peer@c.us') };
        });
        api._callMediaActive = true;
        await expect(
            api.startCall('15551234567', false, false, 1000, false),
        ).to.be.rejectedWith('already active or being started');
        expect(api.teardownCallMediaStream.called).to.equal(false);
        expect(modules.WAWebVoipStartCall.startWAWebVoipCall.called).to.equal(
            false,
        );
    });

    it('restores normal capture when answering without audio injection', async function () {
        const accept = sandbox.stub().resolves();
        modules.WAWebVoipStackInterface = {
            getVoipStackInterface: async () => ({ acceptCall: accept }),
        };
        api._callMediaActive = true;
        await api.acceptCall('incoming-call', false, false);
        expect(api._callMediaActive).to.equal(false);
        expect(accept.calledOnceWithExactly('incoming-call', false)).to.equal(
            true,
        );
    });

    it('rejects when the call ends while waiting for the answer', async function () {
        const assertion = expect(
            api.startCall('peer@c.us', false, true, 1000, false),
        ).to.be.rejectedWith('ended before it was answered');
        setTimeout(() => {
            collection.activeCall = null;
        }, 300);
        await clock.tickAsync(500);
        await assertion;
    });

    it('waits for connectivity on the actual active call', async function () {
        const promise = api.startCall('peer@c.us', false, true, 1000, false);
        setTimeout(() => {
            collection.isInConnectedCall = true;
        }, 400);
        await clock.tickAsync(500);
        const call = await promise;
        expect(call.id).to.equal('outgoing-call');
        expect(api.isCallConnected(call.id)).to.equal(true);
    });

    it('passes group-call origin and trust in their current argument positions', async function () {
        const promise = api.startGroupCall(['peer@c.us', 'other@c.us']);
        await clock.tickAsync(100);
        const call = await promise;
        expect(call.isGroup).to.equal(true);
        expect(
            modules.WAWebVoipStartCall.startWAWebVoipGroupCallFromWids.firstCall.args.slice(
                1,
            ),
        ).to.deep.equal([false, 7, 9, { entryTrust: 'user_gesture' }]);
    });

    it('rejects declined group-call starts', async function () {
        modules.WAWebVoipStartCall.startWAWebVoipGroupCallFromWids.resolves(
            false,
        );
        await expect(
            api.startGroupCall(['peer@c.us', 'other@c.us']),
        ).to.be.rejectedWith('declined to start');
    });

    it('rejects a group start when only a historical group call exists', async function () {
        collection.lastActiveCall = { ...outgoing, isGroup: true };
        modules.WAWebVoipStartCall.startWAWebVoipGroupCallFromWids.resolves();
        const assertion = expect(
            api.startGroupCall(['peer@c.us', 'other@c.us']),
        ).to.be.rejectedWith('not promoted to an active call');
        await clock.tickAsync(5100);
        await assertion;
    });
});
