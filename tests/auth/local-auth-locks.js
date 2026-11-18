const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const LocalAuth = require('../../src/authStrategies/LocalAuth');

function createProfile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wwebjs-local-'));
    for (const lock of [
        'SingletonCookie',
        'SingletonSocket',
        'SingletonLock',
    ]) {
        fs.writeFileSync(path.join(dir, lock), 'stale');
    }
    fs.writeFileSync(path.join(dir, 'Preferences'), '{}');
    fs.mkdirSync(path.join(dir, 'Default'));
    fs.writeFileSync(path.join(dir, 'Default', 'SingletonCookie'), 'nested');
    return dir;
}

describe('LocalAuth stale Chromium locks', function () {
    it('removes top-level Singleton lock files', function () {
        const dir = createProfile();
        const strategy = new LocalAuth({ clientId: 'test' });
        strategy.removeStaleChromiumLocks(dir);
        for (const lock of [
            'SingletonCookie',
            'SingletonSocket',
            'SingletonLock',
        ]) {
            expect(fs.existsSync(path.join(dir, lock))).to.equal(false);
        }
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('keeps real profile data and nested files', function () {
        const dir = createProfile();
        const strategy = new LocalAuth({ clientId: 'test' });
        strategy.removeStaleChromiumLocks(dir);
        expect(fs.existsSync(path.join(dir, 'Preferences'))).to.equal(true);
        expect(fs.existsSync(path.join(dir, 'Default'))).to.equal(true);
        expect(
            fs.existsSync(path.join(dir, 'Default', 'SingletonCookie')),
        ).to.equal(true);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('does not throw for a missing directory', function () {
        const strategy = new LocalAuth({ clientId: 'test' });
        expect(() =>
            strategy.removeStaleChromiumLocks(
                path.join(os.tmpdir(), 'wwebjs-local-missing'),
            ),
        ).to.not.throw();
    });

    it('cleans locks during beforeBrowserInitialized', async function () {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wwebjs-auth-'));
        const strategy = new LocalAuth({ clientId: 'locks', dataPath: base });
        strategy.client = { options: { puppeteer: {} } };
        const dirPath = path.join(base, 'session-locks');
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(path.join(dirPath, 'SingletonLock'), 'stale');
        await strategy.beforeBrowserInitialized();
        expect(fs.existsSync(path.join(dirPath, 'SingletonLock'))).to.equal(
            false,
        );
        expect(strategy.client.options.puppeteer.userDataDir).to.equal(dirPath);
        fs.rmSync(base, { recursive: true, force: true });
    });
});
