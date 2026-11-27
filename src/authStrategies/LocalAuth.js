'use strict';

const path = require('path');
const fs = require('fs');
const BaseAuthStrategy = require('./BaseAuthStrategy');

/**
 * Removes stale Chromium lock files from the user data directory
 * @param {string} userDataDir - Path to the user data directory
 */
async function removeStaleLocks(userDataDir) {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

    for (const lockFile of lockFiles) {
        const lockPath = path.join(userDataDir, lockFile);
        try {
            await fs.promises.access(lockPath);
            await fs.promises.unlink(lockPath);
        } catch {
            // Lock file doesn't exist, continue
        }
    }
}

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

        // Remove stale Chromium locks on startup
        await removeStaleLocks(dirPath);

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath,
        };

        this.userDataDir = dirPath;
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
