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
    try {
        await page.exposeFunction(name, fn);
    } catch (err) {
        // The existence check above and exposeFunction are two separate steps, so
        // concurrent injections (e.g. during the post-authentication page reload)
        // can both pass the check and the slower one throws "already exists".
        // The binding is present either way, so that error is safe to ignore.
        if (!/already exists/.test(err.message)) {
            throw err;
        }
    }
}

module.exports = { exposeFunctionIfAbsent };
