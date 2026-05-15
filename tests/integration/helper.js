const { Client, LocalAuth } = require('../..');

require('dotenv').config();

const remoteId = process.env.WWEBJS_TEST_REMOTE_ID;
if (!remoteId)
    throw new Error(
        'The WWEBJS_TEST_REMOTE_ID environment variable has not been set.',
    );

function createClient({ authenticated, options: additionalOpts } = {}) {
    const options = {};

    if (authenticated) {
        const clientId = process.env.WWEBJS_TEST_CLIENT_ID;
        if (!clientId) throw new Error('No session found in environment.');
        options.authStrategy = new LocalAuth({
            clientId,
        });
    }

    const allOpts = { ...options, ...(additionalOpts || {}) };
    return new Client(allOpts);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    sleep,
    createClient,
    remoteId,
};
