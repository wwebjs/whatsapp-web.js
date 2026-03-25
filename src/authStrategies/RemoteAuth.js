'use strict';

/* Require Optional Dependencies */
try {
    var fs = require('fs-extra');
    var unzipper = require('unzipper');
    var archiver = require('archiver');
} catch {
    fs = undefined;
    unzipper = undefined;
    archiver = undefined;
}

const path = require('path');
const { Events } = require('./../util/Constants');
const BaseAuthStrategy = require('./BaseAuthStrategy');

/**
 * Remote-based authentication
 * @param {object} options - options
 * @param {object} options.store - Remote database store instance
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.backupSyncIntervalMs - Sets the time interval for periodic session backups. Accepts values starting from 60000ms {1 minute}
 * @param {number} options.rmMaxRetries - Sets the maximum number of retries for removing the session directory
 */
class RemoteAuth extends BaseAuthStrategy {
    constructor({
        clientId,
        dataPath,
        store,
        backupSyncIntervalMs,
        rmMaxRetries,
    } = {}) {
        if (!fs && !unzipper && !archiver)
            throw new Error(
                'Optional Dependencies [fs-extra, unzipper, archiver] are required to use RemoteAuth. Make sure to run npm install correctly and remove the --no-optional flag',
            );
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            throw new Error(
                'Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.',
            );
        }
        if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
            throw new Error(
                'Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.',
            );
        }
        if (!store) throw new Error('Remote database store is required.');

        this.store = store;
        this.clientId = clientId;
        this.backupSyncIntervalMs = backupSyncIntervalMs;
        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.tempDir = `${this.dataPath}/wwebjs_temp_session_${this.clientId}`;
        this.requiredDirs = [
            'Default',
            'IndexedDB',
            'Local Storage',
        ]; /* => Required Files & Dirs in WWebJS to restore session */
        this.rmMaxRetries = rmMaxRetries ?? 4;
    }

    async beforeBrowserInitialized() {
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId
            ? `RemoteAuth-${this.clientId}`
            : 'RemoteAuth';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (
            puppeteerOpts.userDataDir &&
            puppeteerOpts.userDataDir !== dirPath
        ) {
            throw new Error(
                'RemoteAuth is not compatible with a user-supplied userDataDir.',
            );
        }

        this.userDataDir = dirPath;
        this.sessionName = sessionDirName;

        await this.extractRemoteSession();

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath,
        };
    }

    async logout() {
        await this.disconnect();
    }

    async destroy() {
        clearInterval(this.backupSync);
    }

    async disconnect() {
        await this.deleteRemoteSession();

        let pathExists = await this.isValidPath(this.userDataDir);
        if (pathExists) {
            await fs.promises
                .rm(this.userDataDir, {
                    recursive: true,
                    force: true,
                    maxRetries: this.rmMaxRetries,
                })
                .catch(() => {});
        }
        clearInterval(this.backupSync);
    }

    async afterAuthReady() {
        const sessionExists = await this.store.sessionExists({
            session: this.sessionName,
        });
        if (!sessionExists) {
            await this.delay(
                60000,
            ); /* Initial delay sync required for session to be stable enough to recover */
            await this.storeRemoteSession({ emit: true });
        }
        var self = this;
        this.backupSync = setInterval(async function () {
            await self.storeRemoteSession();
        }, this.backupSyncIntervalMs);
    }

    async storeRemoteSession(options) {
        const pathExists = await this.isValidPath(this.userDataDir);
        if (!pathExists) return;

        let compressedSessionPath;
        try {
            compressedSessionPath = await this.compressSession();
            await this.store.save({
                session: this.sessionName,
            });
            if (options && options.emit)
                this.client.emit(Events.REMOTE_SESSION_SAVED);
        } finally {
            const paths = [
                this.tempDir,
                ...(compressedSessionPath ? [compressedSessionPath] : []),
            ];
            await Promise.allSettled(
                paths.map((p) =>
                    fs.promises.rm(p, {
                        recursive: true,
                        force: true,
                        maxRetries: this.rmMaxRetries,
                    }),
                ),
            );
        }
    }

    async extractRemoteSession() {
        const pathExists = await this.isValidPath(this.userDataDir);
        const compressedSessionPath = path.join(
            this.dataPath,
            `${this.sessionName}.zip`,
        );
        const sessionExists = await this.store.sessionExists({
            session: this.sessionName,
        });
        if (pathExists) {
            await fs.promises
                .rm(this.userDataDir, {
                    recursive: true,
                    force: true,
                    maxRetries: this.rmMaxRetries,
                })
                .catch(() => {});
        }
        if (sessionExists) {
            await this.store.extract({
                session: this.sessionName,
                path: compressedSessionPath,
            });
            await this.unCompressSession(compressedSessionPath);
        } else {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
    }

    async deleteRemoteSession() {
        const sessionExists = await this.store.sessionExists({
            session: this.sessionName,
        });
        if (sessionExists)
            await this.store.delete({ session: this.sessionName });
    }

    async compressSession() {
        const stageDefaultPath = path.join(this.tempDir, 'Default');
        const userDataDefaultPath = path.join(this.userDataDir, 'Default');

        await fs.emptyDir(stageDefaultPath);
        await this.copyByRequiredDirs(userDataDefaultPath, stageDefaultPath);

        const archive = archiver('zip');
        const outPath = path.join(this.dataPath, `${this.sessionName}.zip`);
        const out = fs.createWriteStream(outPath);

        await new Promise((resolve, reject) => {
            out.once('close', resolve);
            out.once('error', reject);
            archive.once('error', reject);

            archive.pipe(out);
            archive.directory(this.tempDir, false);
            archive.finalize();
        });
        return outPath;
    }

    async unCompressSession(compressedSessionPath) {
        var stream = fs.createReadStream(compressedSessionPath);
        await new Promise((resolve, reject) => {
            stream
                .pipe(
                    unzipper.Extract({
                        path: this.userDataDir,
                        concurrency: 10,
                    }),
                )
                .on('error', (err) => reject(err))
                .on('finish', () => resolve());
        });
        await fs.promises.unlink(compressedSessionPath);
    }

    async copyByRequiredDirs(from, to) {
        for (const d of this.requiredDirs) {
            const src = path.join(from, d);
            if (await this.isValidPath(src)) {
                const dest = path.join(to, path.basename(src));
                await fs.promises.cp(src, dest, {
                    recursive: true,
                    force: true,
                    errorOnExist: false,
                });
            }
        }
    }

    async isValidPath(path) {
        try {
            await fs.promises.access(path);
            return true;
        } catch {
            return false;
        }
    }

    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = RemoteAuth;
