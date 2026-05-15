'use strict';

const { expect } = require('chai');

const NoAuth = require('../../../src/authStrategies/NoAuth');
const BaseAuthStrategy = require('../../../src/authStrategies/BaseAuthStrategy');

describe('NoAuth', function () {
    it('is a BaseAuthStrategy', function () {
        expect(new NoAuth()).to.be.instanceOf(BaseAuthStrategy);
    });

    it('inherits the no-op lifecycle hooks', async function () {
        const auth = new NoAuth();
        await auth.beforeBrowserInitialized();
        await auth.afterBrowserInitialized();
        await auth.afterAuthReady();
        await auth.disconnect();
        await auth.destroy();
        await auth.logout();
        // no throw == pass
    });

    it('reports a non-failed authentication-needed payload', async function () {
        const payload = await new NoAuth().onAuthenticationNeeded();
        expect(payload).to.deep.equal({
            failed: false,
            restart: false,
            failureEventPayload: undefined,
        });
    });

    it('stores the client when setup() is called', function () {
        const auth = new NoAuth();
        const client = { tag: 'client' };
        auth.setup(client);
        expect(auth.client).to.equal(client);
    });
});
