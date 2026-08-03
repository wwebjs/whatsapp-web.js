'use strict';

const Base = require('./Base');

/**
 * Represents a Call on WhatsApp
 * @extends {Base}
 */
class Call extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * Call ID
         * @type {string}
         */
        this.id = data.id;
        /**
         * From
         * @type {string}
         */
        this.from = data.peerJid;
        /**
         * Unix timestamp for when the call was created
         * @type {number}
         */
        this.timestamp = data.offerTime;
        /**
         * Is video
         * @type {boolean}
         */
        this.isVideo = data.isVideo;
        /**
         * Is Group
         * @type {boolean}
         */
        this.isGroup = data.isGroup;
        /**
         * Indicates if the call was sent by the current user
         * @type {boolean}
         */
        this.fromMe = data.outgoing;
        /**
         * Indicates if the call can be handled in waweb
         * @type {boolean}
         */
        this.canHandleLocally = data.canHandleLocally;
        /**
         * Indicates if the call Should be handled in waweb
         * @type {boolean}
         */
        this.webClientShouldHandle = data.webClientShouldHandle;
        /**
         * Object with participants
         * @type {object}
         */
        this.participants = data.participants;

        return super._patch(data);
    }

    /**
     * Reject the call
     */
    async reject() {
        return this.client.pupPage.evaluate(
            (peerJid, id) => {
                return window.WWebJS.rejectCall(peerJid, id);
            },
            this.from,
            this.id,
        );
    }

    /**
     * Accept the call
     * @param {object} [options] Accept options
     * @param {boolean} [options.video=false] Whether to answer with video (requires a camera). Defaults to audio only, even for incoming video calls
     * @param {boolean} [options.injectAudio=true] Route the outgoing audio from injected clips (via playAudio) instead of the real microphone. Set false to answer with the real microphone
     * @returns {Promise<boolean>}
     */
    async accept(options = {}) {
        return this.client.pupPage.evaluate(
            (id, isVideo, injectAudio) => {
                return window.WWebJS.acceptCall(id, isVideo, injectAudio);
            },
            this.id,
            options.video ?? false,
            options.injectAudio ?? true,
        );
    }

    /**
     * End an ongoing call
     * @returns {Promise<boolean>}
     */
    async end() {
        return this.client.pupPage.evaluate((id) => {
            return window.WWebJS.endCall(id);
        }, this.id);
    }

    /**
     * Play an audio clip into the ongoing call so the other party can hear it
     * @param {MessageMedia|string} media A MessageMedia instance or a base64 encoded audio string
     * @returns {Promise<number>} The duration of the played audio in seconds
     */
    async playAudio(media) {
        const data = typeof media === 'string' ? media : media.data;
        return this.client.pupPage.evaluate((base64) => {
            return window.WWebJS.playCallAudio(base64);
        }, data);
    }

    /**
     * Indicates whether the call is currently connected (the other party has answered)
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        return this.client.pupPage.evaluate((id) => {
            return window.WWebJS.isCallConnected(id);
        }, this.id);
    }

    /**
     * Add an individual WhatsApp contact to the active call
     * @param {string} contactId Individual WhatsApp contact ID, e.g. `123456789@c.us`
     */
    async addParticipant(contactId) {
        return this.client.addParticipantToCall(contactId, this.id);
    }
}

module.exports = Call;
