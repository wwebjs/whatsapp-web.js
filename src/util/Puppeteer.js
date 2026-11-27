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
 * @param {number} [retries=3] - Number of retries for transient frame races
 * @param {number} [delay=100] - Delay between retries in ms
 */
async function exposeFunctionIfAbsent(
    page,
    name,
    fn,
    retries = 3,
    delay = 100,
) {
    const exist = await page.evaluate((name) => {
        return !!window[name];
    }, name);
    if (exist) {
        return;
    }

    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            await page.exposeFunction(name, fn);
            return;
        } catch (error) {
            lastError = error;
            // Check if it's a transient frame race error
            if (
                error.message.includes('frame') ||
                error.message.includes('context')
            ) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

module.exports = { exposeFunctionIfAbsent };
