'use strict';

const Base = require('./Base');

/**
 * Represents a Reaction on WhatsApp
 * @extends {Base}
 */
class Reaction extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * Reaction ID
         * @type {object}
         */
        this.id = Reaction._withSerializedId(data.msgKey);
        /**
         * Orphan
         * @type {number}
         */
        this.orphan = data.orphan;
        /**
         * Orphan reason
         * @type {?string}
         */
        this.orphanReason = data.orphanReason;
        /**
         * Unix timestamp for when the reaction was created
         * @type {number}
         */
        this.timestamp = data.timestamp;
        /**
         * Reaction
         * @type {string}
         */
        this.reaction = data.reactionText;
        /**
         * Read
         * @type {boolean}
         */
        this.read = data.read;
        /**
         * Message ID
         * @type {object}
         */
        this.msgId = Reaction._withSerializedId(data.parentMsgKey);
        /**
         * Sender ID
         * @type {string}
         */
        this.senderId = data.senderUserJid;
        /**
         * ACK
         * @type {?number}
         */
        this.ack = data.ack;

        return super._patch(data);
    }

    /**
     * Returns a MsgKey with `_serialized` populated. WhatsApp Web's July 2026 build renamed the
     * property to the minifier-mangled `$1`; `id` and `msgId` are typed as `MessageId`, whose
     * `_serialized` is not optional, so consumers read it directly. Leaves an already-serialized
     * key untouched.
     * @param {object} key
     * @returns {object}
     * @private
     */
    static _withSerializedId(key) {
        if (key && key._serialized == null && key.$1 != null) {
            return Object.assign({}, key, { _serialized: key.$1 });
        }
        return key;
    }
}

module.exports = Reaction;
