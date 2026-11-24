'use strict';

// Serialized into the bot-owned page after authentication. Keep browser-side
// dependencies inside this function.
exports.ForceWebCalling = async () => {
    const ab = window.require('WAWebABProps');
    const gating = window.require('WAWebVoipGatingUtils');
    const unsupportedReason = gating.getUnsupportedBrowserReason?.();
    if (unsupportedReason) {
        throw new Error(
            'WhatsApp Web calling is not supported by this browser: ' +
                unsupportedReason,
        );
    }
    if (typeof ab.getABPropConfigValue !== 'function') {
        throw new Error(
            'This WhatsApp Web version has no supported calling feature gate.',
        );
    }

    const key = Symbol.for('wwebjs.forceWebCalling');
    const existing = window[key];
    if (existing && ab.getABPropConfigValue === existing.replacement) {
        return existing.promise;
    }

    const original = ab.getABPropConfigValue;
    const previousValue = original.call(ab, 'enable_web_calling');
    const replacement = function (name, ...args) {
        return name === 'enable_web_calling'
            ? true
            : original.call(this, name, ...args);
    };
    const state = { original, replacement, promise: null };
    ab.getABPropConfigValue = replacement;
    window[key] = state;

    state.promise = (async () => {
        const controller = new AbortController();
        let timeout;
        try {
            return await Promise.race([
                (async () => {
                    const stack = await window
                        .require('WAWebVoipStackInterface')
                        .getVoipStackInterface();
                    if (!stack) {
                        throw new Error(
                            'WhatsApp calling stack is unavailable after enabling Web calling.',
                        );
                    }
                    await window
                        .require('WAWebEnsureVoipInited')
                        .ensureVoipInitialized('call', controller.signal);
                    if (
                        !window
                            .require('WAWebVoipInitEventEmitter')
                            .VoipInitEventEmitter.getIsVoipInited()
                    ) {
                        throw new Error(
                            'WhatsApp calling engine did not finish initialization.',
                        );
                    }
                    return {
                        overridden: previousValue !== true,
                        initialized: true,
                        stackType: stack.type,
                    };
                })(),
                new Promise((resolve, reject) => {
                    timeout = setTimeout(() => {
                        controller.abort();
                        reject(
                            new Error(
                                'WhatsApp calling engine initialization timed out.',
                            ),
                        );
                    }, 45000);
                }),
            ]);
        } catch (error) {
            if (ab.getABPropConfigValue === replacement) {
                ab.getABPropConfigValue = original;
            }
            if (window[key] === state) delete window[key];
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    })();
    return state.promise;
};
