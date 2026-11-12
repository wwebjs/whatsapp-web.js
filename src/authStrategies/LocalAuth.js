'use strict';

const path = require('path');
const fs = require('fs');
const BaseAuthStrategy = require('./BaseAuthStrategy');

/**
 * Local directory-based authentication
 * @param {object} options - options
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.rmMaxRetries - Sets the maximum number of retries for removing the session directory
 */
class LocalAuth extends BaseAuthStrategy {
    constructor({ clientId, dataPath, rmMaxRetries } = {}) {
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            throw new Error(
                'Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.',
            );
        }

        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.clientId = clientId;
        this.rmMaxRetries = rmMaxRetries ?? 4;
    }

    async beforeBrowserInitialized() {
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId
            ? `session-${this.clientId}`
            : 'session';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (
            puppeteerOpts.userDataDir &&
            puppeteerOpts.userDataDir !== dirPath
        ) {
            throw new Error(
                'LocalAuth is not compatible with a user-supplied userDataDir.',
            );
        }

        fs.mkdirSync(dirPath, { recursive: true });

        this.removeStaleChromiumLocks(dirPath);

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath,
        };

        this.userDataDir = dirPath;
    }

    /**
     * Chromium leaves Singleton lock files behind when the browser is
     * killed without a clean shutdown (server restart, container kill).
     * On the next boot Chrome refuses to start with "profile appears to
     * be in use". Remove those stale locks before launching; the new
     * browser process recreates them. Only the well-known top-level lock
     * files are touched, and cleanup failures never block initialization.
     * @param {string} dirPath
     */
    removeStaleChromiumLocks(dirPath) {
        for (const lockFile of [
            'SingletonCookie',
            'SingletonSocket',
            'SingletonLock',
        ]) {
            try {
                fs.rmSync(path.join(dirPath, lockFile), { force: true });
            } catch {
                // ignore: lock cleanup must never block startup
            }
        }
    }

    async logout() {
        if (this.userDataDir) {
            await fs.promises
                .rm(this.userDataDir, {
                    recursive: true,
                    force: true,
                    maxRetries: this.rmMaxRetries,
                })
                .catch((e) => {
                    throw new Error(e);
                });
        }
    }
}

module.exports = LocalAuth;
