'use strict';
/** Pure helpers: choosing the topic area, de-duplicating titles, tags and the AI disclosure line. */

const DEFAULT_AREAS = ['AI', 'Python', 'Cloud', 'Machine Learning'];
const DEFAULT_DISCLOSURE =
    'This article was written with AI assistance (Claude) and automatically reviewed for accuracy. It may contain mistakes; please verify important details.';

/** Rotates through the areas by day of the year so coverage stays balanced. */
function pickArea(areas, date) {
    const dayOfYear = Math.floor(
        (Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
        ) -
            Date.UTC(date.getUTCFullYear(), 0, 0)) /
            86400000,
    );
    return areas[dayOfYear % areas.length];
}

const words = (t) =>
    new Set(
        t
            .toLowerCase()
            .replace(/[^a-z0-9 ]+/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 2),
    );

/** True when two titles share most of their words (a near-duplicate topic). */
function similar(a, b) {
    const x = words(a);
    const y = words(b);
    if (!x.size || !y.size) return false;
    let common = 0;
    for (const w of x) if (y.has(w)) common++;
    return common / Math.min(x.size, y.size) >= 0.7;
}

/** dev.to tags: lowercase letters/digits only, unique, at most 4. The `extra` tags are always kept. */
function cleanTags(tags, extra = []) {
    const clean = (list) => [
        ...new Set(
            (Array.isArray(list) ? list : [])
                .map((t) =>
                    String(t)
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, ''),
                )
                .filter(Boolean),
        ),
    ];
    const must = clean(extra).slice(0, 4);
    const rest = clean(tags).filter((t) => !must.includes(t));
    return [...rest.slice(0, 4 - must.length), ...must];
}

const AREA_TAGS = {
    ai: ['ai'],
    python: ['python'],
    cloud: ['cloud'],
    'machine learning': ['machinelearning'],
};

/** The disclosure line is always appended; the env var can only change its wording. */
function disclosureLine(custom) {
    return `\n\n---\n*${(custom || '').trim() || DEFAULT_DISCLOSURE}*\n`;
}

module.exports = {
    DEFAULT_AREAS,
    AREA_TAGS,
    pickArea,
    similar,
    cleanTags,
    disclosureLine,
};
