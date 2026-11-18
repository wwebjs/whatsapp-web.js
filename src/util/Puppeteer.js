/**
 * Expose a function to the page if it does not exist
 *
 * NOTE:
 * Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher
 * using page.removeExposedFunction
 * https://pptr.dev/api/puppeteer.page.removeexposedfunction
 *
 * @param {object} page - Puppeteer Page instance
 * @param {string} name
 * @param {Function} fn
 */
async function exposeFunctionIfAbsent(page, name, fn) {
    const exist = await page.evaluate((name) => {
        return !!window[name];
    }, name);
    if (exist) {
        return;
    }
    await exposeFunctionWithRetry(page, name, fn);
}

/**
 * page.exposeFunction rejects with transient errors (e.g. "Target closed"
 * or a detached/destroyed execution context) when a short-lived iframe
 * such as WhatsApp Web's pdf-viewer is torn down mid-call. Retrying those
 * keeps attachEventListeners (and therefore the `ready` event) from dying
 * on a timing race. Anything else is rethrown immediately so real
 * breakage still surfaces.
 *
 * @param {object} page - Puppeteer Page instance
 * @param {string} name
 * @param {Function} fn
 * @param {number} maxAttempts
 */
async function exposeFunctionWithRetry(page, name, fn, maxAttempts = 5) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await page.exposeFunction(name, fn);
            return;
        } catch (err) {
            lastError = err;
            if (!isTransientExposeError(err) || attempt === maxAttempts) {
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
    }
    throw lastError;
}

/**
 * Whether an exposeFunction failure looks like a transient frame/target
 * lifecycle race that is worth retrying.
 *
 * @param {*} err
 * @returns {boolean}
 */
function isTransientExposeError(err) {
    const message = err && err.message ? err.message : String(err);
    return /target closed|detached|destroyed|session closed|execution context/i.test(
        message,
    );
}

module.exports = { exposeFunctionIfAbsent };
