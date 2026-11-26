const assert = require('node:assert/strict');
const vm = require('node:vm');
const Contact = require('../../src/structures/Contact');

describe('Contact.getAbout compatibility', function () {
    const contactId = '1234567890@c.us';
    let modules;
    let requestedModules;
    let contact;
    let wid;

    beforeEach(function () {
        wid = { id: contactId };
        modules = {
            WAWebWidFactory: {
                createWid(id) {
                    assert.equal(id, contactId);
                    return wid;
                },
            },
            WAWebContactStatusBridge: {},
        };
        requestedModules = [];
        const client = {
            pupPage: {
                async evaluate(callback, id) {
                    const evaluate = vm.runInNewContext(
                        `(${callback.toString()})`,
                        {
                            window: {
                                require(name) {
                                    requestedModules.push(name);
                                    if (!(name in modules)) {
                                        throw new Error(
                                            `Missing module: ${name}`,
                                        );
                                    }
                                    return modules[name];
                                },
                            },
                        },
                    );
                    return evaluate(id);
                },
            },
        };
        contact = new Contact(client, { id: { _serialized: contactId } });
    });

    it('keeps the legacy call without requiring the new module', async function () {
        modules.WAWebContactStatusBridge.getStatus = async (options) => {
            assert.equal(options.wid, wid);
            assert.equal(options.token, '');
            return { status: 'Legacy about' };
        };

        assert.equal(await contact.getAbout(), 'Legacy about');
        assert.ok(!requestedModules.includes('WAWebContactTextStatusBridge'));
    });

    it('prefers the legacy API when both APIs exist', async function () {
        modules.WAWebContactStatusBridge.getStatus = async () => ({
            status: 'Legacy about',
        });
        modules.WAWebContactTextStatusBridge = {
            getTextStatus() {
                throw new Error('The legacy API should be used');
            },
        };

        assert.equal(await contact.getAbout(), 'Legacy about');
    });

    it('reads text from the new API when getStatus is missing', async function () {
        modules.WAWebContactTextStatusBridge = {
            async getTextStatus(id) {
                assert.equal(id, wid);
                return { text: 'New about' };
            },
        };

        assert.equal(await contact.getAbout(), 'New about');
    });

    it('preserves null, missing, empty and whitespace text statuses', async function () {
        for (const text of [null, undefined, '', ' ']) {
            modules.WAWebContactTextStatusBridge = {
                getTextStatus: async () => ({ text }),
            };

            assert.equal(await contact.getAbout(), text ?? null);
        }
    });

    it('preserves legacy unavailable biographies as null', async function () {
        modules.WAWebContactStatusBridge.getStatus = async () => ({
            status: undefined,
        });

        assert.equal(await contact.getAbout(), null);
    });

    it('propagates errors returned by the new API', async function () {
        const error = new Error('Text status query failed');
        modules.WAWebContactTextStatusBridge = {
            getTextStatus: async () => ({ text: '', error }),
        };

        await assert.rejects(contact.getAbout(), (actual) => actual === error);
    });

    it('propagates rejected new API queries', async function () {
        const error = new Error('Execution context was destroyed');
        modules.WAWebContactTextStatusBridge = {
            getTextStatus: async () => {
                throw error;
            },
        };

        await assert.rejects(contact.getAbout(), (actual) => actual === error);
    });

    it('does not retry failed legacy queries through the new API', async function () {
        const error = new Error('Legacy query failed');
        modules.WAWebContactStatusBridge.getStatus = async () => {
            throw error;
        };

        await assert.rejects(contact.getAbout(), (actual) => actual === error);
        assert.ok(!requestedModules.includes('WAWebContactTextStatusBridge'));
    });
});
