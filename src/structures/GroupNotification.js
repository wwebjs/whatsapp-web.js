'use strict';

const Base = require('./Base');

/**
 * Represents a GroupNotification on WhatsApp
 * @extends {Base}
 */
class GroupNotification extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the groupNotification
         * @type {object}
         */
        this.id = Base._normalizeId(data.id);

        /**
         * Extra content
         * @type {string}
         */
        this.body = data.body || '';

        /**
         * GroupNotification type
         * @type {GroupNotificationTypes}
         */
        this.type = data.subtype;

        /**
         * Unix timestamp for when the groupNotification was created
         * @type {number}
         */
        this.timestamp = data.t;

        /**
         * ID for the Chat that this groupNotification was sent for.
         *
         * @type {string}
         */
        this.chatId =
            typeof data.id.remote === 'object'
                ? data.id.remote._serialized || data.id.remote.$1
                : data.id.remote;

        /**
         * ContactId for the user that produced the GroupNotification.
         * @type {string}
         */
        this.author =
            typeof data.author === 'object'
                ? data.author._serialized || data.author.$1
                : data.author;

        /**
         * Contact IDs for the users that were affected by this GroupNotification.
         * @type {Array<string>}
         */
        this.recipientIds = [];

        if (data.recipients) {
            this.recipientIds = data.recipients;
        }

        return super._patch(data);
    }

    /**
     * Returns the Chat this groupNotification was sent in
     * @returns {Promise<Chat>}
     */
    getChat() {
        return this.client.getChatById(this.chatId);
    }

    /**
     * Returns the Contact this GroupNotification was produced by
     * @returns {Promise<Contact>}
     */
    getContact() {
        return this.client.getContactById(this.author);
    }

    /**
     * Returns the Contacts affected by this GroupNotification.
     * @returns {Promise<Array<Contact>>}
     */
    async getRecipients() {
        return await Promise.all(
            this.recipientIds.map(
                async (m) => await this.client.getContactById(m),
            ),
        );
    }

    /**
     * Sends a message to the same chat this GroupNotification was produced in.
     *
     * @param {string|MessageMedia|Location} content
     * @param {object} options
     * @returns {Promise<Message>}
     */
    async reply(content, options = {}) {
        return this.client.sendMessage(this.chatId, content, options);
    }
}

module.exports = GroupNotification;
