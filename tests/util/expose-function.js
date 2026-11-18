const { expect } = require('chai');

const { exposeFunctionIfAbsent } = require('../../src/util/Puppeteer');

function createPage({ present = false, failures = [] } = {}) {
    const calls = { expose: 0 };
    return {
        calls,
        evaluate: async () => present,
        exposeFunction: async () => {
            calls.expose++;
            const next = failures.shift();
            if (next) throw next;
        },
    };
}

describe('exposeFunctionIfAbsent', function () {
    it('skips exposing when the function already exists', async function () {
        const page = createPage({ present: true });
        await exposeFunctionIfAbsent(page, 'onAddMessageEvent', () => {});
        expect(page.calls.expose).to.equal(0);
    });

    it('exposes on the first attempt when absent', async function () {
        const page = createPage({ present: false });
        await exposeFunctionIfAbsent(page, 'onAddMessageEvent', () => {});
        expect(page.calls.expose).to.equal(1);
    });

    it('retries transient "Target closed" failures then succeeds', async function () {
        const page = createPage({
            present: false,
            failures: [
                new Error('Target closed'),
                new Error(
                    "Attempted to use detached Frame '28F5ADBA4934BB56D3595F5F0C2600EA'",
                ),
            ],
        });
        await exposeFunctionIfAbsent(page, 'onAddMessageEvent', () => {});
        expect(page.calls.expose).to.equal(3);
    });

    it('rethrows after exhausting retries on persistent failures', async function () {
        const page = createPage({
            present: false,
            failures: Array.from(
                { length: 10 },
                () => new Error('Target closed'),
            ),
        });
        let thrown;
        try {
            await exposeFunctionIfAbsent(page, 'onAddMessageEvent', () => {});
        } catch (err) {
            thrown = err;
        }
        expect(thrown).to.be.instanceOf(Error);
        expect(thrown.message).to.equal('Target closed');
        expect(page.calls.expose).to.equal(5);
    });

    it('fails fast on non-transient errors', async function () {
        const page = createPage({
            present: false,
            failures: [new Error('Protocol error: something else broke')],
        });
        let thrown;
        try {
            await exposeFunctionIfAbsent(page, 'onAddMessageEvent', () => {});
        } catch (err) {
            thrown = err;
        }
        expect(thrown).to.be.instanceOf(Error);
        expect(page.calls.expose).to.equal(1);
    });
});
