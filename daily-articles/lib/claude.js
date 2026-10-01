'use strict';
/** Thin wrapper around the official Anthropic SDK: one call that returns text, plus JSON parsing. */

const DEFAULT_MODEL = 'claude-opus-5-5';

class ConfigError extends Error {}

/** Returns an `ask(system, user, { effort, maxTokens })` function bound to the config. */
function makeAsk(cfg) {
    let client;
    const getClient = () => {
        if (!cfg.anthropicKey)
            throw new ConfigError('ANTHROPIC_API_KEY is not set');
        if (!client) {
            const Anthropic = require('@anthropic-ai/sdk');
            client = new (Anthropic.default || Anthropic)({
                apiKey: cfg.anthropicKey,
                ...(cfg.anthropicBaseUrl
                    ? { baseURL: cfg.anthropicBaseUrl }
                    : {}),
            });
        }
        return client;
    };

    return async function ask(
        system,
        user,
        { effort = 'medium', maxTokens = 16000 } = {},
    ) {
        const request = {
            model: cfg.model || DEFAULT_MODEL,
            max_tokens: maxTokens,
            output_config: { effort },
            system,
            messages: [{ role: 'user', content: user }],
        };
        let res;
        try {
            // Server-side fallback: if a safety classifier declines, Anthropic re-runs it on another model.
            res = await getClient().beta.messages.create({
                ...request,
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
            });
        } catch (e) {
            if (!/fallback/i.test(String(e && e.message))) throw e;
            res = await getClient().messages.create(request);
        }
        if (res.stop_reason === 'refusal')
            throw new Error('The model declined this request');
        if (res.stop_reason === 'max_tokens')
            throw new Error('The model output was cut off (max_tokens)');
        return res.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('');
    };
}

/** Pulls the first JSON value out of a model reply (tolerates a ```json wrapper and chatter around it). */
function parseJsonLoose(text) {
    // Do not strip ``` characters: an article body inside the JSON contains code fences of its own.
    const start = text.search(/[[{]/);
    if (start < 0) throw new Error('No JSON in the model reply');
    const close = text[start] === '[' ? ']' : '}';
    const end = text.lastIndexOf(close);
    return JSON.parse(text.slice(start, end + 1));
}

/** Calls the model and parses JSON, retrying once if the reply is not valid JSON. */
async function askJson(ask, system, user, opts) {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return parseJsonLoose(await ask(system, user, opts));
        } catch (e) {
            lastError = e;
            if (!(e instanceof SyntaxError || /No JSON/.test(e.message)))
                throw e;
        }
    }
    throw lastError;
}

module.exports = {
    makeAsk,
    askJson,
    parseJsonLoose,
    ConfigError,
    DEFAULT_MODEL,
};
