'use strict';

const Base = require('./Base');
const Message = require('./Message');

/**
 * Represents a Status/Story on WhatsApp
 * @extends {Base}
 */
class Broadcast extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the chat
         * @type {object}
         */
        this.id = Base._normalizeId(data.id);

        /**
         * Unix timestamp of last status
         * @type {number}
         */
        this.timestamp = data.t;

        /**
         * Number of available statuses
         * @type {number}
         */
        this.totalCount = data.totalCount;

        /**
         * Number of not viewed
         * @type {number}
         */
        this.unreadCount = data.unreadCount;

        /**
         * Messages statuses
         * @type {Message[]}
         */
        this.msgs = data.msgs?.map((msg) => new Message(this.client, msg));

        return super._patch(data);
    }

    /**
     * Returns the Chat this message was sent in
     * @returns {Promise<Chat>}
     */
    getChat() {
        return this.client.getChatById(this.id._serialized);
    }

    /**
     * Returns the Contact this message was sent from
     * @returns {Promise<Contact>}
     */
    getContact() {
        return this.client.getContactById(this.id._serialized);
    }
}

module.exports = Broadcast;
