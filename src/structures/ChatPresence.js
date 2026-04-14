'use strict';

const Base = require('./Base');

/**
 * Represents the presence state of a chat or contact on WhatsApp:
 * whether the peer is online, typing, recording audio, and when they were last seen.
 * @extends {Base}
 */
class ChatPresence extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * Serialized chat id this presence refers to
         * @type {string}
         */
        this.id = data.id;

        /**
         * Whether this presence belongs to a group chat
         * @type {boolean}
         */
        this.isGroup = data.isGroup;

        /**
         * Whether the peer is currently online.
         * - 1:1 chats: `true` / `false` / `undefined` (undefined before the first push or while privacy-blocked).
         * - Group chats: `true` if any member is currently available.
         * @type {?boolean}
         */
        this.isOnline = data.isOnline;

        /**
         * Current chatstate for 1:1 chats. One of `'available'`, `'typing'`,
         * `'recording_audio'`, `'unavailable'`, or `null`.
         *
         * Always `null` for groups — use {@link ChatPresence#typingParticipants} and
         * {@link ChatPresence#recordingParticipants} instead.
         *
         * NOTE: WhatsApp Web itself auto-reverts `'typing'`/`'recording_audio'` to
         * `'available'` or `'unavailable'` 25 seconds after the last stanza (timer in
         * `WAWebChangePresenceHandlerAction`). This emits a second `presence_update`
         * event without any server push — this is WhatsApp's own client-side
         * behavior, not a library quirk.
         *
         * `'composing'` / `'paused'` are wire-level WA protocol names that never appear
         * here — the handler normalizes them to `'typing'` and `'available'` / `'unavailable'`
         * before writing the model.
         * @type {?string}
         */
        this.chatstate = data.chatstate;

        /**
         * Last-seen unix timestamp in seconds. Only populated when
         * `chatstate === 'unavailable'` and the peer has not blocked last-seen visibility.
         * @type {?number}
         */
        this.lastSeen = data.lastSeen;

        /**
         * True when the peer has explicitly denied last-seen/online visibility via privacy
         * settings. The server still delivers presence pushes, but `lastSeen` stays `null`
         * and `isOnline` typically stays `false`/`undefined`.
         *
         * Distinct from "no data at all" (`hasData === false`), which indicates either no
         * subscription yet or server-side reciprocity enforcement.
         * @type {boolean}
         */
        this.deny = data.deny;

        /**
         * Group only: serialized ids of participants currently typing,
         * ordered by most-recent activity.
         * @type {string[]}
         */
        this.typingParticipants = data.typingParticipants;

        /**
         * Group only: serialized ids of participants currently recording audio.
         * @type {string[]}
         */
        this.recordingParticipants = data.recordingParticipants;

        /**
         * True once the server has pushed at least one presence update for this chat.
         * @type {boolean}
         */
        this.hasData = data.hasData;

        /**
         * True once a subscription stanza has been delivered and acknowledged. Sticky —
         * does not reset on its own.
         * @type {boolean}
         */
        this.isSubscribed = data.isSubscribed;

        return super._patch(data);
    }
}

module.exports = ChatPresence;
