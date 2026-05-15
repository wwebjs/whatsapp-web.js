'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');

const LocalAuth = require('../../../src/authStrategies/LocalAuth');
const BaseAuthStrategy = require('../../../src/authStrategies/BaseAuthStrategy');

describe('LocalAuth', function () {
    it('extends BaseAuthStrategy', function () {
        expect(new LocalAuth()).to.be.instanceOf(BaseAuthStrategy);
    });

    it('rejects invalid clientId characters', function () {
        expect(() => new LocalAuth({ clientId: 'has spaces' })).to.throw(
            /Invalid clientId/,
        );
        expect(() => new LocalAuth({ clientId: 'with/slash' })).to.throw(
            /Invalid clientId/,
        );
    });

    it('accepts alphanumeric, underscore and hyphen clientIds', function () {
        expect(() => new LocalAuth({ clientId: 'abc_123-XYZ' })).to.not.throw();
    });

    it('defaults dataPath to ./.wwebjs_auth/ (resolved absolute)', function () {
        const auth = new LocalAuth();
        expect(auth.dataPath).to.equal(path.resolve('./.wwebjs_auth/'));
    });

    it('resolves a custom dataPath to an absolute path', function () {
        const auth = new LocalAuth({ dataPath: './custom/auth-store' });
        expect(path.isAbsolute(auth.dataPath)).to.equal(true);
        expect(
            auth.dataPath.endsWith(path.join('custom', 'auth-store')),
        ).to.equal(true);
    });

    it('defaults rmMaxRetries to 4 and respects custom values', function () {
        expect(new LocalAuth().rmMaxRetries).to.equal(4);
        expect(new LocalAuth({ rmMaxRetries: 0 }).rmMaxRetries).to.equal(0);
        expect(new LocalAuth({ rmMaxRetries: 9 }).rmMaxRetries).to.equal(9);
    });

    describe('beforeBrowserInitialized', function () {
        let tempDir;

        beforeEach(function () {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wwebjs-auth-'));
        });

        afterEach(function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('creates the session directory and writes it into puppeteer.userDataDir', async function () {
            const auth = new LocalAuth({
                clientId: 'unit',
                dataPath: tempDir,
            });
            auth.client = { options: { puppeteer: {} } };

            await auth.beforeBrowserInitialized();

            const expectedDir = path.join(tempDir, 'session-unit');
            expect(auth.userDataDir).to.equal(expectedDir);
            expect(fs.existsSync(expectedDir)).to.equal(true);
            expect(auth.client.options.puppeteer.userDataDir).to.equal(
                expectedDir,
            );
        });

        it('uses "session" as the directory name when no clientId is set', async function () {
            const auth = new LocalAuth({ dataPath: tempDir });
            auth.client = { options: { puppeteer: {} } };

            await auth.beforeBrowserInitialized();

            expect(auth.userDataDir).to.equal(path.join(tempDir, 'session'));
        });

        it('throws when puppeteer.userDataDir is set to a different path', async function () {
            const auth = new LocalAuth({ clientId: 'x', dataPath: tempDir });
            auth.client = {
                options: { puppeteer: { userDataDir: '/some/other/path' } },
            };

            let err;
            try {
                await auth.beforeBrowserInitialized();
            } catch (e) {
                err = e;
            }
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.match(/not compatible/i);
        });
    });
});
