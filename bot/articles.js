'use strict';
/**
 * Article helpers for the bot: topic ideas and drafts written with the Claude API
 * (official @anthropic-ai/sdk), and publishing to dev.to.
 *
 * Secrets come from environment variables / bot/.env and are never stored in the repo:
 *   ANTHROPIC_API_KEY   Claude API key (needed for ideas and drafts)
 *   DEVTO_API_KEY       dev.to API key (needed to publish or save drafts there)
 * Optional: ARTICLE_MODEL (default claude-opus-5-5), ARTICLE_DISCLOSURE, DEVTO_BASE_URL.
 */

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_DISCLOSURE =
    'This article was drafted with AI assistance (Claude) and reviewed and edited by the author before publishing.';

class MissingKeyError extends Error {
    constructor(name) {
        super(`${name} is not set`);
        this.name = 'MissingKeyError';
        this.keyName = name;
    }
}

let client;
function getClient() {
    if (!process.env.ANTHROPIC_API_KEY)
        throw new MissingKeyError('ANTHROPIC_API_KEY');
    if (!client) {
        const Anthropic = require('@anthropic-ai/sdk');
        client = new (Anthropic.default || Anthropic)(); // reads ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
    }
    return client;
}

/** One Claude call that returns plain text. Retries once without the fallback option if that is rejected. */
async function ask(
    system,
    user,
    { effort = 'medium', maxTokens = 16000 } = {},
) {
    const request = {
        model: process.env.ARTICLE_MODEL || DEFAULT_MODEL,
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
        throw new Error(
            'The AI declined to write about that. Try a different topic.',
        );
    if (res.stop_reason === 'max_tokens')
        throw new Error(
            'The answer was cut off (too long). Try a narrower topic.',
        );
    return res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
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

const IDEAS_SYSTEM =
    'You suggest blog article topics for an author who publishes on dev.to. ' +
    'Reply with ONLY a JSON array of exactly 4 strings. Each string is a specific, genuinely useful ' +
    'article title idea (max 90 characters), not clickbait. Do not repeat the recent titles you are given.';

async function generateIdeas(topics, recentTitles = []) {
    const text = await ask(
        IDEAS_SYSTEM,
        `Topics the author writes about: ${topics.join(', ')}\n` +
            `Recent titles (avoid): ${recentTitles.join(' | ') || 'none'}`,
        { effort: 'low', maxTokens: 4000 },
    );
    let ideas;
    try {
        ideas = parseJsonLoose(text);
    } catch {
        ideas = text
            .split('\n')
            .map((l) => l.replace(/^[-*\d.\s"]+|["\s,]+$/g, ''));
    }
    ideas = ideas
        .map((i) => String(i).trim().slice(0, 90))
        .filter(Boolean)
        .slice(0, 4);
    if (!ideas.length) throw new Error('No ideas came back. Try again.');
    return ideas;
}

const DRAFT_SYSTEM = `You write articles for an author who publishes on dev.to.
Write one useful, accurate, original article in Markdown, about 700-1000 words, practical and well structured,
with concrete examples (and short code blocks when relevant). Start with a short intro, then use "##" headings.
Do not put the title in the body.
Rules: never invent facts, statistics, quotes, benchmarks, links or sources. Never claim personal experience, results or
tests the author did not describe. If you are not sure about something, leave it out or say it depends.
Reply with ONLY a JSON object, no other text:
{"title": "max 90 characters", "description": "one sentence, max 150 characters",
 "tags": ["up to 4 lowercase single-word tags"], "body_markdown": "the article body"}`;

/** Normalises tags to dev.to's rules: lowercase letters/digits only, at most 4. */
function cleanTags(tags) {
    return [
        ...new Set(
            (Array.isArray(tags) ? tags : [])
                .map((t) =>
                    String(t)
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, ''),
                )
                .filter(Boolean),
        ),
    ].slice(0, 4);
}

/** Writes a draft (or a revision when previous + feedback are given). Returns { title, description, tags, body }. */
async function generateDraft(topic, { feedback, previous } = {}) {
    let prompt = `Topic: ${topic}`;
    if (previous && feedback)
        prompt +=
            `\n\nHere is the previous draft:\nTitle: ${previous.title}\n${previous.body_markdown}\n\n` +
            `Rewrite it applying this feedback: ${feedback}`;
    const d = parseJsonLoose(
        await ask(DRAFT_SYSTEM, prompt, { effort: 'medium' }),
    );
    if (!d.title || !d.body_markdown)
        throw new Error('The draft came back incomplete. Try again.');
    return {
        title: String(d.title).slice(0, 120),
        description: String(d.description || '').slice(0, 150),
        tags: cleanTags(d.tags),
        body_markdown: String(d.body_markdown).trim(),
    };
}

const disclosure = () =>
    `\n\n---\n*${process.env.ARTICLE_DISCLOSURE || DEFAULT_DISCLOSURE}*\n`;

/** Publishes (published=true) or saves as a draft (published=false) on dev.to. Returns { url, id }. */
async function publishToDevto(draft, published) {
    const key = process.env.DEVTO_API_KEY;
    if (!key) throw new MissingKeyError('DEVTO_API_KEY');
    const base = process.env.DEVTO_BASE_URL || 'https://dev.to';
    const res = await fetch(`${base}/api/articles`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: {
            'api-key': key,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.forem.api-v1+json',
        },
        body: JSON.stringify({
            article: {
                title: draft.title,
                body_markdown: draft.body_markdown + disclosure(),
                published,
                tags: draft.tags,
                description: draft.description,
            },
        }),
    });
    const text = await res.text();
    let data = {};
    try {
        data = JSON.parse(text);
    } catch {
        /* non-JSON error body */
    }
    if (!res.ok)
        throw new Error(
            `dev.to said ${res.status}${data.error ? ': ' + data.error : ''}`,
        );
    return { url: data.url, id: data.id };
}

/** Splits long text into chunks (on paragraph breaks where possible) for WhatsApp messages. */
function chunkText(text, size = 3500) {
    const out = [];
    let rest = text.trim();
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n\n', size);
        if (cut < size / 2) cut = rest.lastIndexOf('\n', size);
        if (cut < size / 2) cut = size;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
}

module.exports = {
    MissingKeyError,
    generateIdeas,
    generateDraft,
    publishToDevto,
    chunkText,
    cleanTags,
    parseJsonLoose,
    disclosure,
};
