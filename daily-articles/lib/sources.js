'use strict';
/**
 * Fresh, real-world material for each day's article, so it can cover what is current instead of only what the
 * model remembers: recent library releases (GitHub release feeds, PyPI), cloud announcements (AWS, Google Cloud)
 * and the hottest new developer questions (Stack Overflow). Everything is public and needs no account.
 * A source that fails is skipped; the run continues with whatever was gathered.
 */

const DAY = 86400000;
const gh = (repo) => ({
    type: 'feed',
    name: `${repo} releases`,
    path: `github:/${repo}/releases.atom`,
});
const pypi = (pkg) => ({
    type: 'feed',
    name: `${pkg} on PyPI`,
    path: `pypi:/rss/project/${pkg}/releases.xml`,
});

const AREAS = {
    ai: {
        feeds: [
            gh('huggingface/transformers'),
            gh('langchain-ai/langchain'),
            gh('ollama/ollama'),
            gh('vllm-project/vllm'),
        ],
        questions: ['huggingface-transformers', 'langchain', 'openai-api'],
    },
    python: {
        feeds: [
            gh('astral-sh/uv'),
            gh('pydantic/pydantic'),
            gh('fastapi/fastapi'),
            gh('pandas-dev/pandas'),
            pypi('pydantic'),
        ],
        questions: ['python', 'pip', 'pandas'],
    },
    cloud: {
        feeds: [
            {
                type: 'feed',
                name: "AWS What's New",
                path: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/',
            },
            {
                type: 'feed',
                name: 'Google Cloud release notes',
                path: 'https://cloud.google.com/feeds/gcp-release-notes.xml',
            },
            gh('hashicorp/terraform'),
            gh('helm/helm'),
        ],
        questions: ['amazon-web-services', 'kubernetes', 'terraform', 'docker'],
    },
    'machine learning': {
        feeds: [
            gh('pytorch/pytorch'),
            gh('scikit-learn/scikit-learn'),
            gh('mlflow/mlflow'),
            pypi('scikit-learn'),
        ],
        questions: ['machine-learning', 'pytorch', 'scikit-learn'],
    },
};

const DEFAULT_HOSTS = {
    github: 'https://github.com',
    pypi: 'https://pypi.org',
    stack: 'https://api.stackexchange.com',
};

const decode = (s) =>
    s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, '&');
const strip = (html) =>
    decode(
        decode(html)
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<[^>]+>/g, ' '),
    )
        .replace(/\s+/g, ' ')
        .trim();

/** Parses RSS (<item>) and Atom (<entry>) feeds into { title, link, date, summary }. */
function parseFeed(xml) {
    const tag = (block, name) => {
        const m = new RegExp(
            `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
            'i',
        ).exec(block);
        return m ? m[1] : '';
    };
    const items = [];
    for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
        const b = m[0];
        let link = strip(tag(b, 'link'));
        if (!link) {
            const l = /<link[^>]*?href=["']([^"']+)["'][^>]*>/i.exec(b);
            link = l ? decode(l[1]) : '';
        }
        const date = strip(
            tag(b, 'pubDate') ||
                tag(b, 'updated') ||
                tag(b, 'published') ||
                tag(b, 'dc:date'),
        );
        items.push({
            title: strip(tag(b, 'title')),
            link,
            date: Number.isNaN(Date.parse(date))
                ? null
                : new Date(date).toISOString(),
            summary: strip(
                tag(b, 'content') || tag(b, 'description') || tag(b, 'summary'),
            ).slice(0, 700),
        });
    }
    return items.filter((i) => i.title && /^https?:\/\//.test(i.link));
}

function feedUrl(path, hosts) {
    const m = /^(github|pypi):(.*)$/.exec(path);
    return m ? hosts[m[1]] + m[2] : path;
}

async function getText(url, fetchFn) {
    const res = await fetchFn(url, {
        signal: AbortSignal.timeout(20000),
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; daily-articles)',
            Accept: '*/*',
        },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
}

/**
 * Collects recent material for an area. Returns { items, failed }.
 * items: { kind: 'release'|'news'|'question', title, link, date, summary, source, score? }
 */
async function gatherSignals(area, cfg = {}, now = new Date()) {
    const fetchFn = cfg.fetch || fetch;
    const hosts = { ...DEFAULT_HOSTS, ...(cfg.hosts || {}) };
    const spec = cfg.sourceOverride ||
        AREAS[area.toLowerCase()] || { feeds: [], questions: [] };
    const failed = [];
    const items = [];

    await Promise.all([
        ...(spec.feeds || []).map(async (f) => {
            try {
                const xml = await getText(feedUrl(f.path, hosts), fetchFn);
                for (const i of parseFeed(xml).slice(0, 6))
                    items.push({
                        ...i,
                        kind: /releases|PyPI/.test(f.name) ? 'release' : 'news',
                        source: f.name,
                    });
            } catch (e) {
                failed.push(`${f.name}: ${e.message}`);
            }
        }),
        ...(spec.questions || []).map(async (tag) => {
            try {
                const from = Math.floor((now.getTime() - 14 * DAY) / 1000);
                const url = `${hosts.stack}/2.3/questions?order=desc&sort=votes&site=stackoverflow&pagesize=5&fromdate=${from}&tagged=${encodeURIComponent(tag)}`;
                const data = JSON.parse(await getText(url, fetchFn));
                for (const q of data.items || [])
                    items.push({
                        kind: 'question',
                        title: decode(q.title || ''),
                        link: q.link,
                        date: new Date(q.creation_date * 1000).toISOString(),
                        summary: `Tags: ${(q.tags || []).join(', ')}. Votes: ${q.score}. Answers: ${q.answer_count}.`,
                        source: `Stack Overflow [${tag}]`,
                        score: q.score,
                    });
            } catch (e) {
                failed.push(`Stack Overflow [${tag}]: ${e.message}`);
            }
        }),
    ]);

    // Keep it fresh and small: releases/news from the last 30 days, questions by votes.
    const cutoff = now.getTime() - 30 * DAY;
    const fresh = items.filter(
        (i) => i.kind === 'question' || !i.date || Date.parse(i.date) >= cutoff,
    );
    const byDate = (a, b) =>
        (Date.parse(b.date || 0) || 0) - (Date.parse(a.date || 0) || 0);
    const news = fresh
        .filter((i) => i.kind !== 'question')
        .sort(byDate)
        .slice(0, 10);
    const questions = fresh
        .filter((i) => i.kind === 'question')
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);
    return { items: [...news, ...questions], failed };
}

/** Text block handed to the model. It is untrusted data: the prompt tells the model never to follow it. */
function sourcesBlock(items) {
    if (!items.length) return 'none (no fresh sources could be fetched today)';
    return items
        .map(
            (i, n) =>
                `[${n + 1}] (${i.kind}, ${i.source}${i.date ? ', ' + i.date.slice(0, 10) : ''}) ${i.title}\n    ${i.link}\n    ${i.summary}`,
        )
        .join('\n');
}

module.exports = {
    gatherSignals,
    parseFeed,
    sourcesBlock,
    feedUrl,
    DEFAULT_HOSTS,
    AREAS,
};
