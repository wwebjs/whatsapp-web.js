const path = require('path');
const fs = require('fs');

const { WebCache, VersionResolveError } = require('./WebCache');

/**
 * LocalWebCache - Fetches a WhatsApp Web version from a local file store
 * @param {object} options - options
 * @param {string} options.path - Path to the directory where cached versions are saved, default is: "./.wwebjs_cache/"
 * @param {boolean} options.strict - If true, will throw an error if the requested version can't be fetched. If false, will resolve to the latest version.
 */
class LocalWebCache extends WebCache {
    constructor(options = {}) {
        super();

        this.path = options.path || './.wwebjs_cache/';
        this.strict = options.strict || false;
    }

    /**
     * Validates the version string and resolves the cache file path.
     * Rejects traversal attempts and ensures the path stays within the cache directory.
     * @param {string} version - The version string to validate
     * @returns {string} The resolved file path
     * @throws {VersionResolveError} If the version is invalid or escapes the cache directory
     */
    resolveVersionFilePath(version) {
        // Validate version is a dotted numeric string (e.g. "2.3000.1017054665")
        if (!/^\d+(\.\d+)*$/.test(String(version))) {
            throw new VersionResolveError(
                `Invalid version: ${version}`,
            );
        }

        const filePath = path.join(this.path, `${version}.html`);
        const resolvedPath = path.resolve(filePath);
        const cacheDir = path.resolve(this.path) + path.sep;

        if (!resolvedPath.startsWith(cacheDir)) {
            throw new VersionResolveError(
                `Version ${version} resolves outside the cache directory`,
            );
        }

        return resolvedPath;
    }

    async resolve(version) {
        const filePath = this.resolveVersionFilePath(version);

        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (ignoredError) {
            if (this.strict)
                throw new VersionResolveError(
                    `Couldn't load version ${version} from the cache`,
                );
            return null;
        }
    }

    async persist(indexHtml, version) {
        const filePath = this.resolveVersionFilePath(version);
        fs.mkdirSync(this.path, { recursive: true });
        fs.writeFileSync(filePath, indexHtml);
    }
}

module.exports = LocalWebCache;
