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
 * Retorna os argumentos otimizados para redução de consumo de RAM
 * e evasão de bloqueios na inicialização do Chromium.
 */
function getOptimizedPuppeteerArgs(customArgs = []) {
    const defaultArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-infobars',
        '--disable-breakpad',
        '--disable-extensions',
        '--mute-audio',
        '--disable-blink-features=AutomationControlled'
    ];

    return [...new Set([...defaultArgs, ...customArgs])];
}

module.exports = { exposeFunctionIfAbsent, getOptimizedPuppeteerArgs };
