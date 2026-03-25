'use strict';

const Base = require('./Base');

/**
 * ID that represents a contact
 * @typedef {Object} ContactId
 * @property {string} server
 * @property {string} user
 * @property {string} _serialized
 */

/**
 * Represents a Contact on WhatsApp
 * @extends {Base}
 */
class Contact extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the contact
         * @type {ContactId}
         */
        this.id = data.id;

        /**
         * Contact's phone number
         * @type {string}
         */
        this.number = data.userid;

        /**
         * Indicates if the contact is a business contact
         * @type {boolean}
         */
        this.isBusiness = data.isBusiness;

        /**
         * Indicates if the contact is an enterprise contact
         * @type {boolean}
         */
        this.isEnterprise = data.isEnterprise;

        this.labels = data.labels;

        /**
         * The contact's name, as saved by the current user
         * @type {?string}
         */
        this.name = data.name;

        /**
         * The name that the contact has configured to be shown publically
         * @type {string}
         */
        this.pushname = data.pushname;

        this.sectionHeader = data.sectionHeader;

        /**
         * A shortened version of name
         * @type {?string}
         */
        this.shortName = data.shortName;

        this.statusMute = data.statusMute;
        this.type = data.type;
        this.verifiedLevel = data.verifiedLevel;
        this.verifiedName = data.verifiedName;

        /**
         * Indicates if the contact is the current user's contact
         * @type {boolean}
         */
        this.isMe = data.isMe;

        /**
         * Indicates if the contact is a user contact
         * @type {boolean}
         */
        this.isUser = data.isUser;

        /**
         * Indicates if the contact is a group contact
         * @type {boolean}
         */
        this.isGroup = data.isGroup;

        /**
         * Indicates if the number is registered on WhatsApp
         * @type {boolean}
         */
        this.isWAContact = data.isWAContact;

        /**
         * Indicates if the number is saved in the current phone's contacts
         * @type {boolean}
         */
        this.isMyContact = data.isMyContact;

        /**
         * Indicates if you have blocked this contact
         * @type {boolean}
         */
        this.isBlocked = data.isBlocked;

        return super._patch(data);
    }

    /**
     * Returns the contact's profile picture URL, if privacy settings allow it
     * @returns {Promise<string>}
     */
    async getProfilePicUrl() {
        return await this.client.getProfilePicUrl(this.id._serialized);
    }

    /**
     * Returns the contact's formatted phone number, (12345678901@c.us) => (+1 (234) 5678-901)
     * @returns {Promise<string>}
     */
    async getFormattedNumber() {
        return await this.client.getFormattedNumber(this.id._serialized);
    }

    /**
     * Returns the contact's countrycode, (1541859685@c.us) => (1)
     * @returns {Promise<string>}
     */
    async getCountryCode() {
        return await this.client.getCountryCode(this.id._serialized);
    }

    /**
     * Returns the Chat that corresponds to this Contact.
     * Will return null when getting chat for currently logged in user.
     * @returns {Promise<Chat>}
     */
    async getChat() {
        if (this.isMe) return null;

        return await this.client.getChatById(this.id._serialized);
    }

    /**
     * Blocks this contact from WhatsApp
     * @returns {Promise<boolean>}
     */
    async block() {
        if (this.isGroup) return false;

        await this.client.pupPage.evaluate(async (contactId) => {
            const contact = await window
                .require('WAWebCollections')
                .Contact.find(contactId);
            const resolved = window
                .require('WAWebBlockContactUtils')
                .getContactToBlockOnlyUseIfNoAssociatedChat(
                    contact,
                    'ChatListBlock',
                );
            await window
                .require('WAWebBlockContactAction')
                .blockContact({ contact: resolved });
        }, this.id._serialized);

        this.isBlocked = true;
        return true;
    }

    /**
     * Unblocks this contact from WhatsApp
     * @returns {Promise<boolean>}
     */
    async unblock() {
        if (this.isGroup) return false;

        await this.client.pupPage.evaluate(async (contactId) => {
            const contact = await window
                .require('WAWebCollections')
                .Contact.find(contactId);
            const resolved = window
                .require('WAWebBlockContactUtils')
                .getContactToBlockOnlyUseIfNoAssociatedChat(
                    contact,
                    'ChatListBlock',
                );
            await window
                .require('WAWebBlockContactAction')
                .unblockContact(resolved);
        }, this.id._serialized);

        this.isBlocked = false;
        return true;
    }

    /**
     * Gets the Contact's current "about" info. Returns null if you don't have permission to read their status.
     * @returns {Promise<?string>}
     */
    async getAbout() {
        const about = await this.client.pupPage.evaluate(async (contactId) => {
            const wid = window.require('WAWebWidFactory').createWid(contactId);
            return window
                .require('WAWebContactStatusBridge')
                .getStatus({ token: '', wid: wid });
        }, this.id._serialized);

        if (typeof about.status !== 'string') return null;

        return about.status;
    }

    /**
     * Gets the Contact's common groups with you. Returns empty array if you don't have any common group.
     * @returns {Promise<WAWebJS.ChatId[]>}
     */
    async getCommonGroups() {
        return await this.client.getCommonGroups(this.id._serialized);
    }

    /**
     * Gets the Contact's current status broadcast.
     * @returns {Promise<Broadcast>}
     */
    async getBroadcast() {
        return await this.client.getBroadcastById(this.id._serialized);
    }
}

module.exports = Contact;
