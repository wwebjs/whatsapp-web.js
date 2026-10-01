'use strict';
/** Automatic checks an article must pass before it may be published live. Returns a list of problems (empty = ok). */

const URL_RE = /https?:\/\/[^\s)>\]"'`]+/g;
const trimUrl = (u) => u.replace(/[.,;:!?]+$/, '');

// Commands that must never appear in an unattended article.
const DANGEROUS = [
    /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b/i,
    /\brm\s+-rf\s+(\/|~|\$HOME)(\s|$)/i,
    /\bchmod\s+(-R\s+)?777\b/i,
    /\bsudo\s+rm\s+-rf\b/i,
    /--(no-verify-ssl|insecure|trusted-host)\b/i,
    /verify\s*=\s*False/i,
];

function wordCount(text) {
    return text
        .replace(/```[\s\S]*?```/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
}

/**
 * @param {string} body markdown body (without the disclosure line)
 * @param {{ allowedUrls?: string[], requireSources?: boolean }} opts
 */
function checkArticle(body, { allowedUrls = [], requireSources = false } = {}) {
    const problems = [];
    const lines = body.split('\n');

    if (lines.some((l) => /^# \S/.test(l)))
        problems.push(
            'The body must not contain a "# " (H1) heading; use "##" and "###".',
        );
    const h2 = lines.filter((l) => /^## \S/.test(l));
    if (h2.length < 4)
        problems.push(`Needs at least 4 "##" sections (found ${h2.length}).`);
    if (!h2.some((l) => /tl;?dr|summary/i.test(l)))
        problems.push('Needs a "## TL;DR" or "## Summary" section.');

    const fences = lines.filter((l) => /^\s*```/.test(l));
    if (fences.length % 2 !== 0) problems.push('A code fence is not closed.');
    const opening = fences.filter((_, i) => i % 2 === 0);
    if (!opening.length) problems.push('Needs at least one fenced code block.');
    if (opening.some((f) => !/^\s*```\s*[A-Za-z0-9+#._-]+/.test(f)))
        problems.push(
            'Every code block must name its language (for example ```python).',
        );

    const words = wordCount(body);
    if (words < 700) problems.push(`Too short (${words} words; at least 700).`);
    if (words > 1800) problems.push(`Too long (${words} words; at most 1800).`);

    if (/^\s*(#{1,6}\s*)?(as an ai|i cannot|i can't)/im.test(body))
        problems.push('Contains assistant-style wording.');
    for (const re of DANGEROUS)
        if (re.test(body))
            problems.push(
                `Contains a risky command or setting (${re.source.slice(0, 40)}...).`,
            );

    const urls = (body.match(URL_RE) || []).map(trimUrl);
    const allowed = new Set(allowedUrls.map(trimUrl));
    const stray = [...new Set(urls)].filter((u) => !allowed.has(u));
    if (stray.length)
        problems.push(
            `Links that are not from the provided sources: ${stray.slice(0, 3).join(', ')}`,
        );
    if (requireSources && !urls.some((u) => allowed.has(u)))
        problems.push(
            'Must cite at least one of the provided sources with its link.',
        );
    if (requireSources && !lines.some((l) => /^## .*sources?/i.test(l)))
        problems.push('Needs a "## Sources" section listing the links used.');

    return problems;
}

module.exports = { checkArticle, wordCount };
