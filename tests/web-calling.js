'use strict';

const chai = require('chai');
const sinon = require('sinon');
const vm = require('vm');
const Client = require('../src/Client');
const { ForceWebCalling } = require('../src/util/Injected/WebCalling');

chai.use(require('chai-as-promised'));
const expect = chai.expect;

describe('Forced Web calling', function () {
    let sandbox;
    let clock;
    let modules;
    let browserWindow;
    let original;
    let force;
    let initialized;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();
        initialized = false;
        original = sandbox.spy(function (name) {
            return name === 'enable_web_calling' ? false : 'unchanged';
        });
        modules = {
            WAWebABProps: { getABPropConfigValue: original },
            WAWebVoipGatingUtils: {
                getUnsupportedBrowserReason: () => null,
            },
            WAWebVoipStackInterface: {
                getVoipStackInterface: sandbox.stub().resolves({ type: 'web' }),
            },
            WAWebEnsureVoipInited: {
                ensureVoipInitialized: sandbox.stub().callsFake(async () => {
                    initialized = true;
                }),
            },
            WAWebVoipInitEventEmitter: {
                VoipInitEventEmitter: {
                    getIsVoipInited: () => initialized,
                },
            },
        };
        browserWindow = { require: (name) => modules[name] };
        const context = vm.createContext({
            window: browserWindow,
            AbortController,
            setTimeout,
            clearTimeout,
        });
        force = vm.runInContext(
            '(' + ForceWebCalling.toString() + ')',
            context,
        );
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('enables the local gate and initializes the real stack before resolving', async function () {
        const result = await force();
        expect(result).to.deep.equal({
            overridden: true,
            initialized: true,
            stackType: 'web',
        });
        expect(
            modules.WAWebABProps.getABPropConfigValue('enable_web_calling'),
        ).to.equal(true);
        const loader = modules.WAWebVoipStackInterface.getVoipStackInterface;
        const init = modules.WAWebEnsureVoipInited.ensureVoipInitialized;
        expect(loader.calledOnce).to.equal(true);
        expect(init.calledOnce).to.equal(true);
        expect(loader.calledBefore(init)).to.equal(true);
        expect(init.firstCall.args[0]).to.equal('call');
        expect(init.firstCall.args[1].aborted).to.equal(false);
    });

    it('preserves unrelated configuration lookups, arguments and receiver', async function () {
        await force();
        const receiver = {};
        const value = modules.WAWebABProps.getABPropConfigValue.call(
            receiver,
            'unrelated_setting',
            'argument',
        );
        expect(value).to.equal('unchanged');
        expect(original.lastCall.args).to.deep.equal([
            'unrelated_setting',
            'argument',
        ]);
        expect(original.lastCall.thisValue).to.equal(receiver);
    });

    it('does not stack wrappers or initialize twice on repeated authentication', async function () {
        const first = force();
        const second = force();
        await Promise.all([first, second]);
        const getter = modules.WAWebABProps.getABPropConfigValue;
        await force();
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(getter);
        expect(
            modules.WAWebVoipStackInterface.getVoipStackInterface.calledOnce,
        ).to.equal(true);
        expect(
            modules.WAWebEnsureVoipInited.ensureVoipInitialized.calledOnce,
        ).to.equal(true);
    });

    it('reports an already enabled session without claiming a changed value', async function () {
        original = modules.WAWebABProps.getABPropConfigValue = () => true;
        expect((await force()).overridden).to.equal(false);
    });

    it('preserves browser capability checks', async function () {
        modules.WAWebVoipGatingUtils.getUnsupportedBrowserReason = () =>
            'missing_atomics';
        await expect(force()).to.be.rejectedWith(
            'not supported by this browser',
        );
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(original);
        expect(
            modules.WAWebVoipStackInterface.getVoipStackInterface.called,
        ).to.equal(false);
    });

    it('restores the gate when the stack is missing and permits a later retry', async function () {
        const loader = modules.WAWebVoipStackInterface.getVoipStackInterface;
        loader.resolves(null);
        await expect(force()).to.be.rejectedWith('stack is unavailable');
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(original);
        loader.resolves({ type: 'web' });
        expect((await force()).initialized).to.equal(true);
    });

    it('restores the gate and preserves initialization errors', async function () {
        modules.WAWebEnsureVoipInited.ensureVoipInitialized.rejects(
            new Error('engine failure'),
        );
        await expect(force()).to.be.rejectedWith('engine failure');
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(original);
    });

    it('requires a confirmed initialized engine', async function () {
        modules.WAWebEnsureVoipInited.ensureVoipInitialized.resolves();
        await expect(force()).to.be.rejectedWith(
            'did not finish initialization',
        );
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(original);
    });

    it('aborts a stalled initialization and restores the gate', async function () {
        const init = modules.WAWebEnsureVoipInited.ensureVoipInitialized;
        init.returns(new Promise(() => {}));
        const assertion = expect(force()).to.be.rejectedWith(
            'initialization timed out',
        );
        await clock.tickAsync(45001);
        await assertion;
        expect(init.firstCall.args[1].aborted).to.equal(true);
        expect(modules.WAWebABProps.getABPropConfigValue).to.equal(original);
    });

    it('does nothing for clients using the default options', async function () {
        const client = new Client();
        client.pupPage = { evaluate: sandbox.stub() };
        expect(client.options.forceWebCalling).to.equal(false);
        await client._prepareWebCalling();
        expect(client.pupPage.evaluate.called).to.equal(false);
    });

    it('uses the existing Puppeteer page for opted-in clients', async function () {
        const client = new Client({ forceWebCalling: true });
        client.pupPage = {
            evaluate: sandbox.stub().resolves({ initialized: true }),
        };
        await client._prepareWebCalling();
        expect(
            client.pupPage.evaluate.calledOnceWithExactly(ForceWebCalling),
        ).to.equal(true);
    });

    it('awaits calling preparation before emitting ready after authentication', async function () {
        const handlers = new Map();
        const client = new Client({ forceWebCalling: true });
        client.pupPage = {
            waitForFunction: sandbox.stub().resolves({
                jsonValue: async () => ({ need: false }),
            }),
            evaluate: sandbox.stub().resolves(false),
            exposeFunction: async (name, handler) => {
                handlers.set(name, handler);
            },
        };
        sandbox.stub(client, 'setDeviceName').resolves();
        sandbox.stub(client, 'getWWebVersion').resolves('2.test');
        let release;
        const preparation = new Promise((resolve) => {
            release = resolve;
        });
        const prepare = sandbox
            .stub(client, '_prepareWebCalling')
            .returns(preparation);
        const ready = sandbox.spy();
        client.on('ready', ready);
        await client.inject();
        // Utilities are already present for this callback; readiness must still
        // wait for the opted-in engine preparation.
        client.pupPage.evaluate.resolves(true);
        const callback = handlers.get('onAppStateHasSyncedEvent')();
        await clock.tickAsync(0);
        expect(prepare.calledOnce).to.equal(true);
        expect(ready.called).to.equal(false);
        release();
        await callback;
        expect(ready.calledOnce).to.equal(true);
    });
});
