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
     * @param {string} [options.orientation='landscape'] Video frame orientation, either 'landscape', 'portrait' or 'auto' (follows the first source). Fixed for the whole call
     * @param {number} [options.resolution=720] Video frame resolution (the short side, in pixels)
     * @returns {Promise<boolean>}
     */
    async accept(options = {}) {
        return this.client.pupPage.evaluate(
            (id, isVideo, injectAudio, video) => {
                return window.WWebJS.acceptCall(
                    id,
                    isVideo,
                    injectAudio,
                    video,
                );
            },
            this.id,
            options.video ?? false,
            options.injectAudio ?? true,
            {
                orientation: options.orientation,
                resolution: options.resolution,
            },
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
     * Show a still image to the other party for the duration of a video call
     * @param {MessageMedia|string} media A MessageMedia image or a base64 encoded image string
     * @returns {Promise<boolean>}
     */
    async showImage(media) {
        const data = typeof media === 'string' ? media : media.data;
        const mimetype =
            typeof media === 'string' ? 'image/jpeg' : media.mimetype;
        return this.client.pupPage.evaluate(
            (base64, type) => {
                return window.WWebJS.showCallImage(base64, type);
            },
            data,
            mimetype,
        );
    }

    /**
     * Play a video clip into the ongoing video call so the other party can see it
     * @param {MessageMedia|string} media A MessageMedia instance or a base64 encoded video string
     * @param {object} [options] Playback options
     * @param {boolean} [options.loop=false] Whether to loop the clip; when false it stops on the last frame
     * @returns {Promise<number>} The duration of the played video in seconds
     */
    async playVideo(media, options = {}) {
        const data = typeof media === 'string' ? media : media.data;
        const mimetype =
            typeof media === 'string' ? 'video/mp4' : media.mimetype;
        return this.client.pupPage.evaluate(
            (base64, type, opts) => {
                return window.WWebJS.playCallVideo(base64, type, opts);
            },
            data,
            mimetype,
            options,
        );
    }

    /**
     * Change the outgoing video resolution during a call. The orientation is
     * fixed when the call starts and cannot be changed, but the resolution can
     * @param {number} resolution The frame resolution (the short side, in pixels)
     * @returns {Promise<boolean>}
     */
    async setVideoResolution(resolution) {
        return this.client.pupPage.evaluate((px) => {
            return window.WWebJS.setCallVideoResolution(px);
        }, resolution);
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
}

module.exports = Call;
