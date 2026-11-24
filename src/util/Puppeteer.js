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
    await page.exposeFunction(name, fn);
}

/**
 * Error messages Puppeteer produces when a page navigation tears down the
 * execution context or frame an in-flight call was using. They are expected
 * while WhatsApp Web navigates (e.g. during its multi-step logout flow).
 */
const NAVIGATION_RACE_ERROR_PATTERNS = [
    /Execution context was destroyed/i,
    /Cannot find context with specified id/i,
    /Target closed/i,
    /Session closed/i,
    /Protocol error\b.*\bdetached/i,
    /Navigating frame was detached/i,
    /Attempted to use detached Frame/i,
];

/**
 * Subset of navigation-race errors that only mean "the page navigated away";
 * unlike Target/Session closed they never indicate that the browser is gone.
 */
const CONTEXT_DESTROYED_ERROR_PATTERNS = [
    /Execution context was destroyed/i,
    /Cannot find context with specified id/i,
    /Navigating frame was detached/i,
    /Attempted to use detached Frame/i,
];

function errorMessage(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    return String(err.message || err);
}

/**
 * Whether an error was caused by a navigation or page teardown racing an
 * in-flight Puppeteer call.
 * @param {*} err
 * @returns {boolean}
 */
function isNavigationRaceError(err) {
    const message = errorMessage(err);
    return NAVIGATION_RACE_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Whether an error only means the execution context or frame was replaced by
 * a navigation (the page itself is still alive).
 * @param {*} err
 * @returns {boolean}
 */
function isContextDestroyedError(err) {
    const message = errorMessage(err);
    return CONTEXT_DESTROYED_ERROR_PATTERNS.some((re) => re.test(message));
}

module.exports = {
    exposeFunctionIfAbsent,
    isNavigationRaceError,
    isContextDestroyedError,
};
