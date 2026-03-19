const { Client, LocalAuth } = require('./index');

// ==========================================
// 1. Client Initialization & Puppeteer Args
// ==========================================
const client = new Client({
    // Uses LocalAuth to persist the WhatsApp session (no need to scan QR code every time)
    authStrategy: new LocalAuth(),
    
    // Configurable message jitter for anti-spam (Enterprise Feature from previous patches)
    messageJitter: { min: 1000, max: 2500 },

    puppeteer: {
        headless: true, // Run without a graphical interface
        args: [
            // Essential optimization flags for low-resource environments (VPS, Docker, etc.)
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Overcomes limited resource problems in Linux containers
            '--disable-accelerated-2d-canvas',
            '--single-process', // Forces Chromium to run in a single process to save RAM
            '--disable-gpu' // Disables hardware acceleration (not needed on servers)
        ]
    }
});

// ==========================================
// 2. Resource Blocking & Memory Purge
// ==========================================
// The 'ready' event is fired when the client is fully initialized and the DOM is available
client.on('ready', async () => {
    console.log('WhatsApp Web Client is ready!');

    // Access the underlying Puppeteer page instance
    const page = client.pupPage;

    try {
        // --- Optimization 1: Visual Resource Blocking ---
        // Enable request interception to prevent downloading unnecessary heavy assets
        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            // Define the types of resources that are completely useless for a headless bot
            const blockedResourceTypes = ['image', 'stylesheet', 'font', 'media'];
            
            // Abort the request if it matches the blocked types, saving bandwidth and CPU
            if (blockedResourceTypes.includes(req.resourceType())) {
                req.abort();
            } else {
                // Continue with the essential requests (like scripts, XHR, and WebSockets)
                req.continue();
            }
        });

        console.log('[Optimization] Resource blocking enabled successfully.');

        // --- Optimization 2: Automatic Memory Purge (Anti-Leak) ---
        // Inject a script into the browser context to periodically prune the internal message cache
        await page.evaluate(() => {
            // Run the Garbage Collector routine every 15 minutes (900,000 ms)
            setInterval(() => {
                try {
                    // Ensure the WAWebCollections object is exposed and available
                    if (window.require) {
                        const WAWebCollections = window.require('WAWebCollections');
                        if (WAWebCollections && WAWebCollections.Msg) {
                            const Msg = WAWebCollections.Msg;
                            const maxMessages = 100; // Safe limit of stored messages
                            
                            // If the cache exceeds the safe limit, prune the oldest messages
                            if (Msg.models.length > maxMessages) {
                                const excess = Msg.models.length - maxMessages;
                                const messagesToRemove = Msg.models.slice(0, excess);
                                
                                // Remove them from the Chromium RAM 
                                Msg.remove(messagesToRemove);
                                console.log(`[Memory Purge] Pruned ${excess} old messages from cache.`);
                            }
                        }
                    }
                } catch (e) {
                    // Fail silently to avoid interrupting the page context
                }
            }, 15 * 60 * 1000); 
        });

        console.log('[Optimization] Automatic memory purge interval injected successfully.');

    } catch (error) {
        console.error('Failed to apply optimizations on page hook:', error);
    }
});

// ==========================================
// 3. Silent Crash Recovery (Auto-Healing)
// ==========================================
// A helper function to force a fatal exit, letting the Process Manager (PM2) handle the restart
const handleFatalCrash = (reason, errorDetails = '') => {
    console.error(`\n[FATAL CRASH] ${reason}. Details: ${errorDetails}`);
    console.error('Forcing process exit to trigger PM2/Docker auto-restart...');
    
    // Exit with code 1 so external managers know the app crashed and immediately restart it
    process.exit(1); 
};

// We must attach browser listeners as soon as the client starts attempting to boot
client.initialize().then(() => {
    // Listen to the Puppeteer browser disconnection (e.g., killed by the OS or zombie process)
    if (client.pupBrowser) {
        client.pupBrowser.on('disconnected', () => {
            handleFatalCrash('Chromium browser disconnected unexpectedly');
        });
        
        // Listen to unexpected target destruction 
        client.pupBrowser.on('targetdestroyed', (target) => {
            if (target.type() === 'page') {
                handleFatalCrash('Chromium target (Page) was destroyed');
            }
        });
    }

    // Listen to fatal errors thrown internally by the WhatsApp Web page context
    if (client.pupPage) {
        client.pupPage.on('error', (err) => {
            handleFatalCrash('Fatal Page Error inside the browser', err.message);
        });
    }
}).catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    process.exit(1);
});

// ==========================================
// Basic Chat Listeners
// ==========================================
const qrcode = require('qrcode-terminal');

client.on('qr', (qr) => {
    console.log('QR Code received. Please scan it:');
    qrcode.generate(qr, { small: true });
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected', reason);
    if (reason === 'BROWSER_CRASH' || reason === 'PAGE_CRASH') {
        console.log('Detected internal crash emission! Restarting client...');
        client.initialize(); // Auto-heal via custom core emitted event
    }
});

client.on('message', async (msg) => {
    if (msg.body === '!ping') {
        await msg.reply('pong');
    }
});
