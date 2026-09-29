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
    } catch (error) {
        // The page may register the binding between evaluate() and
        // exposeFunction(). Treat only that known race as an idempotent result.
        const message = error?.message || String(error);
        if (
            message.includes(`binding with name ${name}`) &&
            message.includes('already exists')
        ) {
            return;
        }
        throw error;
    }
}

module.exports = { exposeFunctionIfAbsent };
