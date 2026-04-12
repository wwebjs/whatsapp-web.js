'use strict';

const Base = require('./Base');
const Message = require('./Message');

/**
 * Represents a Chat on WhatsApp
 * @extends {Base}
 */
class Chat extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the chat
         * @type {object}
         */
        this.id = data.id;

        /**
         * Title of the chat
         * @type {string}
         */
        this.name = data.formattedTitle;

        /**
         * Indicates if the Chat is a Group Chat
         * @type {boolean}
         */
        this.isGroup = data.isGroup;

        /**
         * Indicates if the Chat is readonly
         * @type {boolean}
         */
        this.isReadOnly = data.isReadOnly;

        /**
         * Amount of messages unread
         * @type {number}
         */
        this.unreadCount = data.unreadCount;

        /**
         * Unix timestamp for when the last activity occurred
         * @type {number}
         */
        this.timestamp = data.t;

        /**
         * Indicates if the Chat is archived
         * @type {boolean}
         */
        this.archived = data.archive;

        /**
         * Indicates if the Chat is pinned
         * @type {boolean}
         */
        this.pinned = !!data.pin;

        /**
         * Indicates if the Chat is locked
         * @type {boolean}
         */
        this.isLocked = data.isLocked;

        /**
         * Indicates if the chat is muted or not
         * @type {boolean}
         */
        this.isMuted = data.isMuted;

        /**
         * Unix timestamp for when the mute expires
         * @type {number}
         */
        this.muteExpiration = data.muteExpiration;

        /**
         * Last message fo chat
         * @type {Message}
         */
        this.lastMessage = data.lastMessage
            ? new Message(this.client, data.lastMessage)
            : undefined;

        return super._patch(data);
    }

    /**
     * Send a message to this chat
     * @param {string|MessageMedia|Location} content
     * @param {MessageSendOptions} [options]
     * @returns {Promise<Message>} Message that was just sent
     */
    async sendMessage(content, options) {
        return this.client.sendMessage(this.id._serialized, content, options);
    }

    /**
     * Sets the chat as seen
     * @returns {Promise<Boolean>} result
     */
    async sendSeen() {
        return this.client.sendSeen(this.id._serialized);
    }

    /**
     * Clears all messages from the chat
     * @returns {Promise<boolean>} result
     */
    async clearMessages() {
        return this.client.pupPage.evaluate((chatId) => {
            return window.WWebJS.sendClearChat(chatId);
        }, this.id._serialized);
    }

    /**
     * Deletes the chat
     * @returns {Promise<Boolean>} result
     */
    async delete() {
        return this.client.pupPage.evaluate((chatId) => {
            return window.WWebJS.sendDeleteChat(chatId);
        }, this.id._serialized);
    }

    /**
     * Archives this chat
     */
    async archive() {
        return this.client.archiveChat(this.id._serialized);
    }

    /**
     * un-archives this chat
     */
    async unarchive() {
        return this.client.unarchiveChat(this.id._serialized);
    }

    /**
     * Pins this chat
     * @returns {Promise<boolean>} New pin state. Could be false if the max number of pinned chats was reached.
     */
    async pin() {
        return this.client.pinChat(this.id._serialized);
    }

    /**
     * Unpins this chat
     * @returns {Promise<boolean>} New pin state
     */
    async unpin() {
        return this.client.unpinChat(this.id._serialized);
    }

    /**
     * Mutes this chat forever, unless a date is specified
     * @param {?Date} unmuteDate Date when the chat will be unmuted, don't provide a value to mute forever
     * @returns {Promise<{isMuted: boolean, muteExpiration: number}>}
     */
    async mute(unmuteDate) {
        const result = await this.client.muteChat(
            this.id._serialized,
            unmuteDate,
        );
        this.isMuted = result.isMuted;
        this.muteExpiration = result.muteExpiration;
        return result;
    }

    /**
     * Unmutes this chat
     * @returns {Promise<{isMuted: boolean, muteExpiration: number}>}
     */
    async unmute() {
        const result = await this.client.unmuteChat(this.id._serialized);
        this.isMuted = result.isMuted;
        this.muteExpiration = result.muteExpiration;
        return result;
    }

    /**
     * Mark this chat as unread
     */
    async markUnread() {
        return this.client.markChatUnread(this.id._serialized);
    }

    /**
     * Loads chat messages, sorted from earliest to latest.
     * @param {Object} searchOptions Options for searching messages. Right now only limit and fromMe is supported.
     * @param {Number} [searchOptions.limit] The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation. Set this to Infinity to load all messages.
     * @param {Boolean} [searchOptions.fromMe] Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.
     * @returns {Promise<Array<Message>>}
     */
    async fetchMessages(searchOptions) {
        let messages = await this.client.pupPage.evaluate(
            async (chatId, searchOptions) => {
                const msgFilter = (m) => {
                    if (m.isNotification) {
                        return false; // dont include notification messages
                    }
                    if (
                        searchOptions &&
                        searchOptions.fromMe !== undefined &&
                        m.id.fromMe !== searchOptions.fromMe
                    ) {
                        return false;
                    }
                    return true;
                };

                const chat = await window.WWebJS.getChat(chatId, {
                    getAsModel: false,
                });
                let msgs = chat.msgs.getModelsArray().filter(msgFilter);

                if (searchOptions && searchOptions.limit > 0) {
                    const msgFindLocal = window.require(
                        'WAWebDBMessageFindLocal',
                    );
                    const WAWebMsgKey = window.require('WAWebMsgKey');
                    const MsgStore = window.require('WAWebCollections').Msg;

                    // msgFindByDirection is the newer API; fall back to msgFindBefore on older WA Web versions
                    const findBefore = async (anchorKey, count) => {
                        if (
                            typeof msgFindLocal.msgFindByDirection ===
                            'function'
                        ) {
                            return await msgFindLocal.msgFindByDirection({
                                anchor: anchorKey,
                                count,
                                direction: 'before',
                            });
                        }
                        return await msgFindLocal.msgFindBefore({
                            anchor: anchorKey,
                            count,
                        });
                    };

                    const toMsgKey = (id) => {
                        if (!id) return null;
                        if (id instanceof WAWebMsgKey) return id;
                        const s =
                            typeof id === 'string'
                                ? id
                                : id._serialized || id?.toString?.();
                        return s ? WAWebMsgKey.fromString(s) : null;
                    };

                    const toMsgModels = (rawMessages) => {
                        const out = [];
                        for (const m of rawMessages) {
                            if (m && typeof m.serialize === 'function') {
                                out.push(m);
                                continue;
                            }
                            const serialized =
                                m?.id?._serialized ||
                                (typeof m === 'string' ? m : null);
                            let model =
                                (serialized && MsgStore.get(serialized)) ||
                                (m?.id &&
                                    MsgStore.get(m.id._serialized || m.id)) ||
                                null;
                            if (!model && m && MsgStore.modelClass) {
                                try {
                                    model = new MsgStore.modelClass(m);
                                } catch (e) {
                                    model = null;
                                }
                            }
                            if (model) out.push(model);
                        }
                        return out;
                    };

                    const dedupeByMsgId = (arr) => {
                        const seen = new Set();
                        return arr.filter((m) => {
                            const key = m.id?._serialized;
                            if (!key || seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });
                    };

                    const limit = searchOptions.limit;
                    const finite = Number.isFinite(limit);
                    const fromMeFilter =
                        searchOptions && searchOptions.fromMe !== undefined;

                    if (!fromMeFilter && finite) {
                        const anchorSerialized =
                            chat.lastReceivedKey?.toString();
                        if (!anchorSerialized) {
                            msgs.sort((a, b) => (a.t > b.t ? 1 : -1));
                            msgs = msgs.slice(-Math.min(limit, msgs.length));
                        } else {
                            const fetchCount = Math.max(0, limit - 1);
                            const anchorKey = toMsgKey(anchorSerialized);
                            const result = await findBefore(
                                anchorKey,
                                fetchCount,
                            );
                            const rawMessages = Array.isArray(result)
                                ? result
                                : result?.messages || [];
                            if (
                                result?.status === 404 &&
                                (!rawMessages || !rawMessages.length)
                            ) {
                                // anchor not in local DB — fall back to in-memory msgs (same as the !anchorSerialized branch above)
                                msgs.sort((a, b) => (a.t > b.t ? 1 : -1));
                                msgs = msgs.slice(
                                    -Math.min(limit, msgs.length),
                                );
                            } else {
                                let loaded = toMsgModels(rawMessages);
                                const anchorMsg =
                                    MsgStore.get(anchorSerialized);
                                let merged = [
                                    ...loaded,
                                    ...(anchorMsg ? [anchorMsg] : []),
                                    // include in-memory msgs so recent (not-yet-persisted) messages aren't dropped
                                    ...msgs,
                                ];
                                merged = merged.filter(
                                    (m) => !m.isNotification,
                                );
                                merged.sort((a, b) => (a.t > b.t ? 1 : -1));
                                merged = dedupeByMsgId(merged);
                                msgs = merged.filter(msgFilter);
                                if (msgs.length > limit) {
                                    msgs = msgs.slice(-limit);
                                }
                            }
                        }
                    } else {
                        msgs.sort((a, b) => (a.t > b.t ? 1 : -1));
                        const batchCap = finite ? limit : 100;
                        while (msgs.length < limit || !finite) {
                            const anchor =
                                msgs[0]?.id ||
                                chat.msgs.getModelsArray()[0]?.id ||
                                chat.lastReceivedKey;
                            if (!anchor) break;

                            const anchorKey = toMsgKey(anchor);
                            if (!anchorKey) break;

                            const need = finite
                                ? Math.min(batchCap, limit - msgs.length)
                                : batchCap;
                            if (need <= 0) break;

                            const result = await findBefore(anchorKey, need);
                            const rawMessages = Array.isArray(result)
                                ? result
                                : result?.messages || [];
                            if (result?.status === 404 || !rawMessages.length) {
                                break;
                            }

                            const loadedMessages = toMsgModels(rawMessages);
                            if (!loadedMessages.length) break;

                            const prevLen = msgs.length;
                            msgs = dedupeByMsgId([
                                ...loadedMessages.filter(msgFilter),
                                ...msgs,
                            ]);
                            msgs.sort((a, b) => (a.t > b.t ? 1 : -1));

                            if (msgs.length === prevLen) break;

                            if (!finite && loadedMessages.length < need) {
                                break;
                            }
                        }

                        if (finite && msgs.length > limit) {
                            msgs = msgs.slice(-limit);
                        }
                    }
                }

                return msgs.map((m) => window.WWebJS.getMessageModel(m));
            },
            this.id._serialized,
            searchOptions,
        );

        return messages.map((m) => new Message(this.client, m));
    }

    /**
     * Simulate typing in chat. This will last for 25 seconds.
     */
    async sendStateTyping() {
        return this.client.pupPage.evaluate((chatId) => {
            window.WWebJS.sendChatstate('typing', chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Simulate recording audio in chat. This will last for 25 seconds.
     */
    async sendStateRecording() {
        return this.client.pupPage.evaluate((chatId) => {
            window.WWebJS.sendChatstate('recording', chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Stops typing or recording in chat immediately.
     */
    async clearState() {
        return this.client.pupPage.evaluate((chatId) => {
            window.WWebJS.sendChatstate('stop', chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Returns the Contact that corresponds to this Chat.
     * @returns {Promise<Contact>}
     */
    async getContact() {
        return await this.client.getContactById(this.id._serialized);
    }

    /**
     * Returns array of all Labels assigned to this Chat
     * @returns {Promise<Array<Label>>}
     */
    async getLabels() {
        return this.client.getChatLabels(this.id._serialized);
    }

    /**
     * Add or remove labels to this Chat
     * @param {Array<number|string>} labelIds
     * @returns {Promise<void>}
     */
    async changeLabels(labelIds) {
        return this.client.addOrRemoveLabels(labelIds, [this.id._serialized]);
    }

    /**
     * Gets instances of all pinned messages in a chat
     * @returns {Promise<Array<Message>>}
     */
    async getPinnedMessages() {
        return this.client.getPinnedMessages(this.id._serialized);
    }

    /**
     * Sync chat history conversation
     * @return {Promise<boolean>} True if operation completed successfully, false otherwise.
     */
    async syncHistory() {
        return this.client.syncHistory(this.id._serialized);
    }

    /**
     * Add or edit a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} note The note to add
     * @returns {Promise<void>}
     */
    async addOrEditCustomerNote(note) {
        if (this.isGroup || this.isChannel) return;

        return this.client.addOrEditCustomerNote(this.id._serialized, note);
    }

    /**
     * Get a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @returns {Promise<{
     *    chatId: string,
     *    content: string,
     *    createdAt: number,
     *    id: string,
     *    modifiedAt: number,
     *    type: string
     * }>}
     */
    async getCustomerNote() {
        if (this.isGroup || this.isChannel) return null;

        return this.client.getCustomerNote(this.id._serialized);
    }
}

module.exports = Chat;
