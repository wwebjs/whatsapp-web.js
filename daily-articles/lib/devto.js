'use strict';
/** Minimal dev.to (Forem) API client: list your articles and create one. */

async function request(cfg, method, path, body) {
    if (!cfg.devtoKey) throw new Error('DEVTO_API_KEY is not set');
    const res = await fetch(`${cfg.devtoBaseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(30000),
        headers: {
            'api-key': cfg.devtoKey,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.forem.api-v1+json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = {};
    }
    if (!res.ok)
        throw new Error(
            `dev.to ${method} ${path} -> ${res.status}${data.error ? ': ' + data.error : ''}`,
        );
    return data;
}

/** Your articles (published and drafts), newest first. */
async function myArticles(cfg) {
    const data = await request(cfg, 'GET', '/api/articles/me/all?per_page=100');
    return Array.isArray(data) ? data : [];
}

/** Creates an article. published=false saves an unpublished draft. */
async function createArticle(cfg, article, published) {
    const data = await request(cfg, 'POST', '/api/articles', {
        article: {
            title: article.title,
            body_markdown: article.body_markdown,
            published,
            tags: article.tags,
            description: article.description,
        },
    });
    return { id: data.id, url: data.url };
}

module.exports = { myArticles, createArticle };
