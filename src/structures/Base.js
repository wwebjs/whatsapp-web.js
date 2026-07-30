'use strict';

/**
 * Represents a WhatsApp data structure
 */
class Base {
    constructor(client) {
        /**
         * The client that instantiated this
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: client });
    }

    _clone() {
        return Object.assign(Object.create(this), this);
    }

    _patch(data) {
        return data;
    }

    /**
     * Normalizes a WhatsApp ID object so that `_serialized` is always defined.
     * WhatsApp Web changed `_serialized` to `$1` in July 2026. This ensures
     * backward compatibility so all downstream code can continue using `_serialized`.
     * @param {object} id
     * @returns {object}
     */
    static _normalizeId(id) {
        if (id && id._serialized == null && id.$1 != null) {
            return Object.assign({}, id, { _serialized: id.$1 });
        }
        return id;
    }
}

module.exports = Base;
