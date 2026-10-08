'use strict';

const { Readable } = require('stream');
const Base = require('./Base');
const MessageMedia = require('./MessageMedia');

// Call audio is captured as WhatsApp plays it: 16-bit PCM, mono, 16 kHz
const CALL_AUDIO_SAMPLE_RATE = 16000;

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
     * Gets a live stream of the audio the other party sends in the call, as raw
     * 16-bit little-endian PCM, mono, at 16 kHz. The stream ends when the call ends,
     * and destroying it stops the capture. Only available for calls placed with
     * Client#call or answered with Call#accept
     * @returns {Promise<Readable>}
     */
    async getAudioStream() {
        const streams = this.client._callAudioStreams;
        const stream = new Readable({ read() {} });
        if (!streams.has(this.id)) {
            streams.set(this.id, new Set());
        }
        streams.get(this.id).add(stream);

        stream.on('close', () => {
            const active = streams.get(this.id);
            if (!active || !active.delete(stream) || active.size) return;
            streams.delete(this.id);
            this.client.pupPage
                .evaluate((id) => {
                    return window.WWebJS.stopCallAudioCapture(id, false);
                }, this.id)
                .catch(() => {});
        });

        let started;
        try {
            started = await this.client.pupPage.evaluate((id) => {
                return window.WWebJS.startCallAudioCapture(id);
            }, this.id);
        } catch (err) {
            stream.destroy();
            throw err;
        }
        if (!started) {
            stream.destroy();
            throw new Error('The call is not ongoing');
        }
        return stream;
    }

    /**
     * Records the audio the other party sends in the call until the call ends
     * @param {object} [options] Recording options
     * @param {number} [options.maxDuration] Stop recording after this many milliseconds, even if the call is still going
     * @returns {Promise<MessageMedia>} The recording as a WAV file
     */
    async recordAudio(options = {}) {
        const stream = await this.getAudioStream();
        const chunks = [];
        let timer;
        if (options.maxDuration) {
            timer = setTimeout(() => stream.destroy(), options.maxDuration);
        }

        await new Promise((resolve) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('close', resolve);
        });
        clearTimeout(timer);

        const pcm = Buffer.concat(chunks);
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + pcm.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(CALL_AUDIO_SAMPLE_RATE, 24);
        header.writeUInt32LE(CALL_AUDIO_SAMPLE_RATE * 2, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(pcm.length, 40);

        return new MessageMedia(
            'audio/wav',
            Buffer.concat([header, pcm]).toString('base64'),
            `call-${this.id}.wav`,
        );
    }
}

module.exports = Call;
