const { EventEmitter } = require('events');
const { expect } = require('chai');
const puppeteer = require('puppeteer');
const sinon = require('sinon');
const Client = require('../src/Client');

class NavigationFixture {
    constructor(sandbox) {
        this.sandbox = sandbox;
        this.client = new Client({
            userAgent: false,
            webVersionCache: { type: 'none' },
            puppeteer: { browserWSEndpoint: 'ws://offline-fixture' },
        });
        this.auth = this.client.authStrategy;
        sandbox.stub(this.auth, 'logout').resolves();
        sandbox.stub(this.auth, 'destroy').resolves();
        sandbox.stub(this.auth, 'beforeBrowserInitialized').resolves();
        sandbox.stub(this.auth, 'afterBrowserInitialized').resolves();
        sandbox.stub(this.client, 'inject').resolves();
        sandbox.stub(this.client, 'initWebVersionCache').resolves();
        this.connect = sandbox.stub(puppeteer, 'connect');
        this.page = this.createPage();
        this.client.pupBrowser = { isConnected: () => false };
        this.register(this.page);
    }

    createPage() {
        const page = new EventEmitter();
        page.evaluate = this.sandbox.stub().resolves(false);
        page.goto = this.sandbox.stub().resolves();
        page.frame = {
            parentFrame: () => null,
            url: () => 'https://web.whatsapp.com/',
        };
        return page;
    }

    register(page) {
        this.client.pupPage = page;
        this.client._registerFramenavigatedHandler();
        this.handler = page.listeners('framenavigated')[0];
    }

    navigate() {
        return this.handler(this.page.frame);
    }

    async initialize(page) {
        this.connect.resolves({
            newPage: this.sandbox.stub().resolves(page),
            isConnected: () => false,
        });
        await this.client.initialize();
    }

    hold(stub) {
        let release;
        let started;
        const entered = new Promise((resolve) => {
            started = resolve;
        });
        const pending = new Promise((resolve) => {
            release = resolve;
        });
        stub.onCall(stub.callCount).callsFake(() => {
            started();
            return pending;
        });
        return { entered, release };
    }

    counts() {
        return {
            logout: this.auth.logout.callCount,
            before: this.auth.beforeBrowserInitialized.callCount,
            after: this.auth.afterBrowserInitialized.callCount,
            evaluate: this.page.evaluate.callCount,
            inject: this.client.inject.callCount,
        };
    }
}

describe('Client navigation lifecycle (account-free)', function () {
    let sandbox;
    let fixture;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
        fixture = new NavigationFixture(sandbox);
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('registers only one handler for the same page', function () {
        fixture.client._registerFramenavigatedHandler();
        expect(fixture.page.listenerCount('framenavigated')).to.equal(1);
    });

    it('ignores child frames', async function () {
        await fixture.handler({ parentFrame: () => fixture.page.frame });
        expect(fixture.page.evaluate.called).to.equal(false);
        expect(fixture.client.inject.called).to.equal(false);
    });

    it('skips reinjection for an already wired page', async function () {
        fixture.page.evaluate.resolves(true);
        await fixture.navigate();
        expect(fixture.client.inject.called).to.equal(false);
    });

    it('injects an unwired main page', async function () {
        await fixture.navigate();
        expect(fixture.client.inject.calledOnce).to.equal(true);
    });

    for (const trigger of ['url', 'lastLoggedOut']) {
        const title = `preserves logout hooks and reinjection for ${trigger}`;

        it(title, async function () {
            const disconnected = sandbox.spy();
            fixture.client.on('disconnected', disconnected);
            fixture.page.evaluate.resolves(true);
            if (trigger === 'url') {
                fixture.page.frame.url = () =>
                    'https://web.whatsapp.com/?post_logout=1';
            } else {
                fixture.client.lastLoggedOut = true;
            }

            await fixture.navigate();

            sinon.assert.calledOnceWithExactly(disconnected, 'LOGOUT');
            sinon.assert.callOrder(
                fixture.auth.logout,
                fixture.auth.beforeBrowserInitialized,
                fixture.auth.afterBrowserInitialized,
                fixture.page.evaluate,
                fixture.client.inject,
            );
            expect(fixture.client.lastLoggedOut).to.equal(false);
        });
    }

    it('removes only its own listener on destroy', async function () {
        const otherListener = () => {};
        fixture.page.on('framenavigated', otherListener);
        await fixture.client.destroy();
        expect(fixture.page.listeners('framenavigated')).to.deep.equal([
            otherListener,
        ]);

        await fixture.navigate();
        expect(fixture.page.evaluate.called).to.equal(false);
        expect(fixture.client.inject.called).to.equal(false);
    });

    it('stops if a disconnected listener destroys the client', async function () {
        fixture.client.lastLoggedOut = true;
        let destruction;
        fixture.client.on('disconnected', () => {
            destruction = fixture.client.destroy();
        });

        await fixture.navigate();
        await destruction;
        expect(fixture.auth.logout.called).to.equal(false);
        expect(fixture.auth.beforeBrowserInitialized.called).to.equal(false);
        expect(fixture.page.evaluate.called).to.equal(false);
    });

    it('detaches the old handler when registering a replacement page', async function () {
        const oldHandler = fixture.handler;
        const nextPage = fixture.createPage();
        fixture.register(nextPage);
        expect(fixture.page.listenerCount('framenavigated')).to.equal(0);
        expect(nextPage.listenerCount('framenavigated')).to.equal(1);

        await oldHandler(fixture.page.frame);
        expect(fixture.page.evaluate.called).to.equal(false);
        expect(nextPage.evaluate.called).to.equal(false);
    });

    it('invalidates the old handler before new initialization hooks run', async function () {
        const held = fixture.hold(fixture.auth.beforeBrowserInitialized);
        const initialization = fixture.initialize(fixture.createPage());
        await held.entered;

        await fixture.navigate();
        expect(fixture.page.listenerCount('framenavigated')).to.equal(0);
        expect(fixture.page.evaluate.called).to.equal(false);
        expect(fixture.client.inject.called).to.equal(false);

        held.release();
        await initialization;
        expect(fixture.client.inject.calledOnce).to.equal(true);
    });

    for (const boundary of [
        'logout',
        'beforeBrowserInitialized',
        'afterBrowserInitialized',
        'evaluate',
    ]) {
        const title = `stops an old handler after pending ${boundary} completes`;

        it(title, async function () {
            fixture.client.lastLoggedOut = true;
            const stub =
                boundary === 'evaluate'
                    ? fixture.page.evaluate
                    : fixture.auth[boundary];
            const held = fixture.hold(stub);
            const navigation = fixture.navigate();
            await held.entered;

            await fixture.client.destroy();
            const nextPage = fixture.createPage();
            await fixture.initialize(nextPage);
            fixture.client.lastLoggedOut = true;
            const counts = fixture.counts();

            held.release(false);
            await navigation;

            expect(fixture.counts()).to.deep.equal(counts);
            expect(nextPage.evaluate.called).to.equal(false);
            expect(fixture.client.lastLoggedOut).to.equal(true);
            expect(fixture.page.listenerCount('framenavigated')).to.equal(0);
            expect(nextPage.listenerCount('framenavigated')).to.equal(1);
        });
    }

    it('does not resume a pending handler after destroy without reinitializing', async function () {
        const held = fixture.hold(fixture.page.evaluate);
        const navigation = fixture.navigate();
        await held.entered;
        await fixture.client.destroy();

        held.release(false);
        await navigation;
        expect(fixture.client.inject.called).to.equal(false);
    });

    it('does not reactivate a pending handler when the same page is registered again', async function () {
        const held = fixture.hold(fixture.page.evaluate);
        const navigation = fixture.navigate();
        await held.entered;
        await fixture.client.destroy();
        fixture.register(fixture.page);

        held.release(false);
        await navigation;
        expect(fixture.client.inject.called).to.equal(false);

        await fixture.navigate();
        expect(fixture.client.inject.calledOnce).to.equal(true);
        expect(fixture.page.listenerCount('framenavigated')).to.equal(1);
    });

    it('preserves genuine initialization failures', async function () {
        const failure = new Error('initialization failure');
        fixture.client.inject.rejects(failure);
        let rejected;
        try {
            await fixture.initialize(fixture.createPage());
        } catch (error) {
            rejected = error;
        }
        expect(rejected).to.equal(failure);
    });

    it('does not swallow an auth hook rejection from a pending handler', async function () {
        const failure = new Error('logout failure');
        fixture.client.lastLoggedOut = true;
        fixture.auth.logout.rejects(failure);
        let rejected;
        try {
            await fixture.navigate();
        } catch (error) {
            rejected = error;
        }
        expect(rejected).to.equal(failure);
    });
});
