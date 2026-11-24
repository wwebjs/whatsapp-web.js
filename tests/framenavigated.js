const { EventEmitter } = require('events');
const chai = require('chai');
const sinon = require('sinon');

const Client = require('../src/Client');
const { Events } = require('../src/util/Constants');
const {
    isNavigationRaceError,
    isContextDestroyedError,
} = require('../src/util/Puppeteer');

chai.use(require('chai-as-promised'));
const expect = chai.expect;

// Unit tests with a stubbed Puppeteer page: no browser or WhatsApp session.
const CONTEXT_DESTROYED =
    'Execution context was destroyed, most likely because of a navigation.';
const LOGOUT_URL = 'https://web.whatsapp.com/?post_logout=1';
const APP_URL = 'https://web.whatsapp.com/';

function mainFrame(url) {
    return { parentFrame: () => null, url: () => url };
}

// Let the listener's promise chain settle and give Node the chance to report
// an unhandled rejection (it does so after the microtask queue drains).
function settle() {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('Navigation races', function () {
    describe('Client framenavigated handler', function () {
        let client;
        let page;
        let unhandled;
        let savedListeners;

        function onUnhandled(reason) {
            unhandled.push(reason);
        }

        beforeEach(function () {
            unhandled = [];
            // Take over unhandled-rejection reporting from mocha so that a
            // rejection is recorded as a test failure instead of a crash.
            savedListeners = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', onUnhandled);

            client = new Client();
            page = new EventEmitter();
            page.evaluate = sinon.stub();
            client.pupPage = page;
            sinon.stub(client, 'inject').resolves();
            client._registerFramenavigatedHandler();
        });

        afterEach(function () {
            process.removeListener('unhandledRejection', onUnhandled);
            for (const listener of savedListeners) {
                process.on('unhandledRejection', listener);
            }
            sinon.restore();
        });

        it('survives an evaluate destroyed by the logout navigation and re-injects on the next one', async function () {
            page.evaluate.onFirstCall().rejects(new Error(CONTEXT_DESTROYED));
            page.evaluate.resolves(false);
            const disconnected = sinon.spy();
            client.on(Events.DISCONNECTED, disconnected);

            page.emit('framenavigated', mainFrame(LOGOUT_URL));
            await settle();

            expect(unhandled).to.deep.equal([]);
            expect(disconnected.calledOnceWith('LOGOUT')).to.equal(true);
            expect(client.inject.called).to.equal(false);

            page.emit('framenavigated', mainFrame(APP_URL));
            await settle();

            expect(unhandled).to.deep.equal([]);
            expect(client.inject.calledOnce).to.equal(true);
        });

        it('emits LOGOUT once for a multi-navigation logout but still injects', async function () {
            page.evaluate.resolves(false);
            const disconnected = sinon.spy();
            client.on(Events.DISCONNECTED, disconnected);
            const logout = sinon.spy(client.authStrategy, 'logout');

            // Both navigations fire before the first handler finishes.
            page.emit('framenavigated', mainFrame(LOGOUT_URL));
            page.emit('framenavigated', mainFrame(`${LOGOUT_URL}&reload=1`));
            await settle();

            expect(disconnected.callCount).to.equal(1);
            expect(disconnected.firstCall.args).to.deep.equal(['LOGOUT']);
            expect(logout.callCount).to.equal(1);
            expect(client.inject.callCount).to.equal(2);
            expect(unhandled).to.deep.equal([]);
        });

        it('reports one LOGOUT across logout and in-between regular navigations', async function () {
            page.evaluate.resolves(false);
            const disconnected = sinon.spy();
            client.on(Events.DISCONNECTED, disconnected);

            // WhatsApp Web rewrites ?post_logout=1 to / and may reload again.
            for (const url of [LOGOUT_URL, APP_URL, LOGOUT_URL, APP_URL]) {
                page.emit('framenavigated', mainFrame(url));
                await settle();
            }

            expect(disconnected.callCount).to.equal(1);
            expect(client.inject.callCount).to.equal(4);
        });

        it('reports a logout of a new session again after re-authentication', async function () {
            page.evaluate.resolves(true);
            const disconnected = sinon.spy();
            client.on(Events.DISCONNECTED, disconnected);
            let onSynced;
            page.waitForFunction = sinon.stub().resolves({
                jsonValue: async () => ({ need: false }),
            });
            page.exposeFunction = sinon.stub().callsFake(async (name, fn) => {
                if (name === 'onAppStateHasSyncedEvent') onSynced = fn;
            });
            sinon.stub(client, 'setDeviceName').resolves();
            sinon.stub(client, 'getWWebVersion').resolves('2.3000.0');

            page.emit('framenavigated', mainFrame(LOGOUT_URL));
            await settle();

            // Re-link: run the real inject() to register the auth callback.
            page.evaluate.resolves(false);
            client.inject.restore();
            await client.inject();
            client.attachEventListeners = sinon.stub().resolves();
            await onSynced();

            page.evaluate.resolves(true);
            client.lastLoggedOut = true;
            page.emit('framenavigated', mainFrame(APP_URL));
            await settle();

            expect(disconnected.callCount).to.equal(2);
        });

        it('ignores navigations of child frames', async function () {
            page.emit('framenavigated', {
                parentFrame: () => ({}),
                url: () => LOGOUT_URL,
            });
            await settle();

            expect(page.evaluate.called).to.equal(false);
            expect(client.inject.called).to.equal(false);
        });

        it('swallows a navigation race inside inject()', async function () {
            page.evaluate.resolves(false);
            client.inject.rejects(new Error('Protocol error: Target closed'));

            page.emit('framenavigated', mainFrame(APP_URL));
            await settle();

            expect(unhandled).to.deep.equal([]);
        });

        it('routes unexpected errors to an error listener instead of rejecting', async function () {
            const boom = new Error('boom');
            page.evaluate.rejects(boom);
            const onError = sinon.spy();
            client.on('error', onError);

            page.emit('framenavigated', mainFrame(APP_URL));
            await settle();

            expect(unhandled).to.deep.equal([]);
            expect(onError.calledOnceWith(boom)).to.equal(true);
        });

        it('logs unexpected errors when no error listener exists', async function () {
            const boom = new Error('boom');
            page.evaluate.rejects(boom);
            const consoleError = sinon.stub(console, 'error');

            page.emit('framenavigated', mainFrame(APP_URL));
            await settle();
            consoleError.restore();

            expect(unhandled).to.deep.equal([]);
            expect(consoleError.calledOnce).to.equal(true);
            expect(consoleError.firstCall.args).to.include(boom);
        });
    });

    describe('Client inject() during navigation', function () {
        let client;

        beforeEach(function () {
            client = new Client();
            client.pupPage = {
                waitForFunction: sinon.stub().resolves(),
            };
            sinon
                .stub(client, 'setDeviceName')
                .rejects(new Error(CONTEXT_DESTROYED));
        });

        afterEach(function () {
            sinon.restore();
        });

        it('returns when the framenavigated handler will re-inject', async function () {
            client._framenavigatedRegistered = true;
            await expect(client.inject()).to.be.fulfilled;
        });

        it('still rejects when no handler is registered', async function () {
            client._framenavigatedRegistered = false;
            await expect(client.inject()).to.be.rejectedWith(CONTEXT_DESTROYED);
        });
    });

    describe('Navigation race error classification', function () {
        it('recognises navigation-race errors', function () {
            for (const message of [
                CONTEXT_DESTROYED,
                'Protocol error (Runtime.callFunctionOn): Cannot find context with specified id',
                'Protocol error (Runtime.callFunctionOn): Target closed.',
                'Protocol error (Runtime.evaluate): Session closed. Most likely the page has been closed.',
                'Protocol error: Frame was detached',
                'Navigating frame was detached',
                'Attempted to use detached Frame "ABC".',
            ]) {
                expect(
                    isNavigationRaceError(new Error(message)),
                    message,
                ).to.equal(true);
            }
        });

        it('does not classify unrelated errors', function () {
            for (const err of [
                new Error('boom'),
                new Error(
                    'Protocol error (Runtime.evaluate): Invalid parameters',
                ),
                'auth timeout',
                null,
                undefined,
            ]) {
                expect(isNavigationRaceError(err)).to.equal(false);
            }
        });

        it('keeps browser teardown out of the context-destroyed subset', function () {
            expect(
                isContextDestroyedError(new Error(CONTEXT_DESTROYED)),
            ).to.equal(true);
            expect(
                isContextDestroyedError(
                    new Error('Protocol error: Target closed'),
                ),
            ).to.equal(false);
        });
    });
});
