/**
 * Default implementation of a web version cache that does nothing.
 */
class WebCache {
    async resolve() {
        return null;
    }

    async persist() {}
}

class VersionResolveError extends Error {}

module.exports = {
    WebCache,
    VersionResolveError,
};
