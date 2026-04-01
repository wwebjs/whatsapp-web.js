'use strict';

exports.WhatsWebURL = 'https://web.whatsapp.com/';

exports.DefaultOptions = {
    puppeteer: {
        headless: true,
        defaultViewport: null,
    },
    webVersion: '2.3000.1017054665',
    webVersionCache: {
        type: 'local',
    },
    authTimeoutMs: 0,
    qrMaxRetries: 0,
    takeoverOnConflict: false,
    takeoverTimeoutMs: 0,
    userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
    ffmpegPath: 'ffmpeg',
    bypassCSP: false,
    proxyAuthentication: undefined,
    pairWithPhoneNumber: {
        phoneNumber: '',
        showNotification: true,
        intervalMs: 180000,
    },
};

/**
 * Client status
 * @readonly
 * @enum {number}
 */
exports.Status = {
    INITIALIZING: 0,
    AUTHENTICATING: 1,
    READY: 3,
};

/**
 * Events that can be emitted by the client
 * @readonly
 * @enum {string}
 */
exports.Events = {
    AUTHENTICATED: 'authenticated',
    AUTHENTICATION_FAILURE: 'auth_failure',
    READY: 'ready',
    CHAT_REMOVED: 'chat_removed',
    CHAT_ARCHIVED: 'chat_archived',
    MESSAGE_RECEIVED: 'message',
    MESSAGE_CIPHERTEXT: 'message_ciphertext',
    MESSAGE_CIPHERTEXT_FAILED: 'message_ciphertext_failed',
    MESSAGE_CREATE: 'message_create',
    MESSAGE_REVOKED_EVERYONE: 'message_revoke_everyone',
    MESSAGE_REVOKED_ME: 'message_revoke_me',
    MESSAGE_ACK: 'message_ack',
    MESSAGE_EDIT: 'message_edit',
    UNREAD_COUNT: 'unread_count',
    MESSAGE_REACTION: 'message_reaction',
    MEDIA_UPLOADED: 'media_uploaded',
    CONTACT_CHANGED: 'contact_changed',
    GROUP_JOIN: 'group_join',
    GROUP_LEAVE: 'group_leave',
    GROUP_ADMIN_CHANGED: 'group_admin_changed',
    GROUP_MEMBERSHIP_REQUEST: 'group_membership_request',
    GROUP_UPDATE: 'group_update',
    QR_RECEIVED: 'qr',
    CODE_RECEIVED: 'code',
    LOADING_SCREEN: 'loading_screen',
    DISCONNECTED: 'disconnected',
    STATE_CHANGED: 'change_state',
    BATTERY_CHANGED: 'change_battery',
    INCOMING_CALL: 'call',
    REMOTE_SESSION_SAVED: 'remote_session_saved',
    VOTE_UPDATE: 'vote_update',
};

/**
 * Message types
 * @readonly
 * @enum {string}
 */
exports.MessageTypes = {
    TEXT: 'chat',
    AUDIO: 'audio',
    VOICE: 'ptt',
    IMAGE: 'image',
    ALBUM: 'album',
    VIDEO: 'video',
    DOCUMENT: 'document',
    STICKER: 'sticker',
    LOCATION: 'location',
    CONTACT_CARD: 'vcard',
    CONTACT_CARD_MULTI: 'multi_vcard',
    ORDER: 'order',
    REVOKED: 'revoked',
    PRODUCT: 'product',
    UNKNOWN: 'unknown',
    GROUP_INVITE: 'groups_v4_invite',
    LIST: 'list',
    LIST_RESPONSE: 'list_response',
    BUTTONS_RESPONSE: 'buttons_response',
    PAYMENT: 'payment',
    BROADCAST_NOTIFICATION: 'broadcast_notification',
    CALL_LOG: 'call_log',
    CIPHERTEXT: 'ciphertext',
    DEBUG: 'debug',
    E2E_NOTIFICATION: 'e2e_notification',
    GP2: 'gp2',
    GROUP_NOTIFICATION: 'group_notification',
    HSM: 'hsm',
    INTERACTIVE: 'interactive',
    NATIVE_FLOW: 'native_flow',
    NOTIFICATION: 'notification',
    NOTIFICATION_TEMPLATE: 'notification_template',
    OVERSIZED: 'oversized',
    PROTOCOL: 'protocol',
    REACTION: 'reaction',
    TEMPLATE_BUTTON_REPLY: 'template_button_reply',
    POLL_CREATION: 'poll_creation',
    SCHEDULED_EVENT_CREATION: 'scheduled_event_creation',
};

/**
 * Group notification types
 * @readonly
 * @enum {string}
 */
exports.GroupNotificationTypes = {
    ADD: 'add',
    INVITE: 'invite',
    REMOVE: 'remove',
    LEAVE: 'leave',
    PROMOTE: 'promote',
    DEMOTE: 'demote',
    SUBJECT: 'subject',
    DESCRIPTION: 'description',
    PICTURE: 'picture',
    ANNOUNCE: 'announce',
    RESTRICT: 'restrict',
};

/**
 * Chat types
 * @readonly
 * @enum {string}
 */
exports.ChatTypes = {
    SOLO: 'solo',
    GROUP: 'group',
    UNKNOWN: 'unknown',
};

/**
 * WhatsApp state
 * @readonly
 * @enum {string}
 */
exports.WAState = {
    CONFLICT: 'CONFLICT',
    CONNECTED: 'CONNECTED',
    DEPRECATED_VERSION: 'DEPRECATED_VERSION',
    OPENING: 'OPENING',
    PAIRING: 'PAIRING',
    PROXYBLOCK: 'PROXYBLOCK',
    SMB_TOS_BLOCK: 'SMB_TOS_BLOCK',
    TIMEOUT: 'TIMEOUT',
    TOS_BLOCK: 'TOS_BLOCK',
    UNLAUNCHED: 'UNLAUNCHED',
    UNPAIRED: 'UNPAIRED',
    UNPAIRED_IDLE: 'UNPAIRED_IDLE',
};

/**
 * Message ACK
 * @readonly
 * @enum {number}
 */
exports.MessageAck = {
    ACK_ERROR: -1,
    ACK_PENDING: 0,
    ACK_SERVER: 1,
    ACK_DEVICE: 2,
    ACK_READ: 3,
    ACK_PLAYED: 4,
};
