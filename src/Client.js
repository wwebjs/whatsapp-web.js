'use strict';

const EventEmitter = require('events');
const puppeteer = require('puppeteer');

const Util = require('./util/Util');
const InterfaceController = require('./util/InterfaceController');
const {
    WhatsWebURL,
    DefaultOptions,
    Events,
    WAState,
    MessageTypes,
} = require('./util/Constants');
const { ExposeAuthStore } = require('./util/Injected/AuthStore/AuthStore');
const { LoadUtils } = require('./util/Injected/Utils');
const ChatFactory = require('./factories/ChatFactory');
const ContactFactory = require('./factories/ContactFactory');
const WebCacheFactory = require('./webCache/WebCacheFactory');
const {
    ClientInfo,
    Message,
    MessageMedia,
    Contact,
    Location,
    Poll,
    PollVote,
    GroupNotification,
    Label,
    Call,
    Buttons,
    List,
    Reaction,
    Broadcast,
    ScheduledEvent,
} = require('./structures');
const NoAuth = require('./authStrategies/NoAuth');
const { exposeFunctionIfAbsent } = require('./util/Puppeteer');

/**
 * Starting point for interacting with the WhatsApp Web API
 * @extends {EventEmitter}
 * @param {object} options - Client options
 * @param {AuthStrategy} options.authStrategy - Determines how to save and restore sessions. If not set, NoAuth will be used.
 * @param {string} options.webVersion - The version of WhatsApp Web to use. Use options.webVersionCache to configure how the version is retrieved.
 * @param {object} options.webVersionCache - Determines how to retrieve the WhatsApp Web version. Defaults to a local cache (LocalWebCache) that falls back to latest if the requested version is not found.
 * @param {number} options.authTimeoutMs - Timeout for authentication selector in puppeteer
 * @param {function} options.evalOnNewDoc - function to eval on new doc
 * @param {object} options.puppeteer - Puppeteer launch options. View docs here: https://github.com/puppeteer/puppeteer/
 * @param {number} options.qrMaxRetries - How many times should the qrcode be refreshed before giving up
 * @param {number} options.takeoverOnConflict - If another whatsapp web session is detected (another browser), take over the session in the current browser
 * @param {number} options.takeoverTimeoutMs - How much time to wait before taking over the session
 * @param {string} options.userAgent - User agent to use in puppeteer
 * @param {string} options.ffmpegPath - Ffmpeg path to use when formatting videos to webp while sending stickers
 * @param {boolean} options.bypassCSP - Sets bypassing of page's Content-Security-Policy.
 * @param {string} options.deviceName - Sets the device name of a current linked device., i.e.: 'TEST'.
 * @param {string} options.browserName - Sets the browser name of a current linked device, i.e.: 'Firefox'.
 * @param {object} options.proxyAuthentication - Proxy Authentication object.
 *
 * @fires Client#qr
 * @fires Client#authenticated
 * @fires Client#auth_failure
 * @fires Client#ready
 * @fires Client#message
 * @fires Client#message_ack
 * @fires Client#message_create
 * @fires Client#message_revoke_me
 * @fires Client#message_revoke_everyone
 * @fires Client#message_ciphertext
 * @fires Client#message_edit
 * @fires Client#media_uploaded
 * @fires Client#group_join
 * @fires Client#group_leave
 * @fires Client#group_update
 * @fires Client#disconnected
 * @fires Client#change_state
 * @fires Client#contact_changed
 * @fires Client#group_admin_changed
 * @fires Client#group_membership_request
 * @fires Client#vote_update
 */
class Client extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = Util.mergeDefault(DefaultOptions, options);

        if (!this.options.authStrategy) {
            this.authStrategy = new NoAuth();
        } else {
            this.authStrategy = this.options.authStrategy;
        }

        this.authStrategy.setup(this);

        /**
         * @type {puppeteer.Browser}
         */
        this.pupBrowser = null;
        /**
         * @type {puppeteer.Page}
         */
        this.pupPage = null;

        this.currentIndexHtml = null;
        this.lastLoggedOut = false;

        Util.setFfmpegPath(this.options.ffmpegPath);
    }
    /**
     * Injection logic
     * Private function
     */
    async inject() {
        if (
            this.options.authTimeoutMs === undefined ||
            this.options.authTimeoutMs == 0
        ) {
            this.options.authTimeoutMs = 30000;
        }
        let start = Date.now();
        let timeout = this.options.authTimeoutMs;
        let res = false;
        while (start > Date.now() - timeout) {
            res = await this.pupPage.evaluate(
                'window.Debug?.VERSION != undefined',
            );
            if (res) {
                break;
            }
            await new Promise((r) => setTimeout(r, 200));
        }
        if (!res) {
            throw 'auth timeout';
        }
        await this.setDeviceName(
            this.options.deviceName,
            this.options.browserName,
        );
        const pairWithPhoneNumber = this.options.pairWithPhoneNumber;
        const version = await this.getWWebVersion();

        await this.pupPage.evaluate(ExposeAuthStore);

        const needAuthentication = await this.pupPage.evaluate(async () => {
            let state = window.require('WAWebSocketModel').Socket.state;

            if (
                state === 'OPENING' ||
                state === 'UNLAUNCHED' ||
                state === 'PAIRING'
            ) {
                // wait till state changes
                await new Promise((r) => {
                    window
                        .require('WAWebSocketModel')
                        .Socket.on(
                            'change:state',
                            function waitTillInit(_AppState, state) {
                                if (
                                    state !== 'OPENING' &&
                                    state !== 'UNLAUNCHED' &&
                                    state !== 'PAIRING'
                                ) {
                                    window
                                        .require('WAWebSocketModel')
                                        .Socket.off(
                                            'change:state',
                                            waitTillInit,
                                        );
                                    r();
                                }
                            },
                        );
                });
            }
            state = window.require('WAWebSocketModel').Socket.state;
            return state == 'UNPAIRED' || state == 'UNPAIRED_IDLE';
        });

        if (needAuthentication) {
            const { failed, failureEventPayload, restart } =
                await this.authStrategy.onAuthenticationNeeded();

            if (failed) {
                /**
                 * Emitted when there has been an error while trying to restore an existing session
                 * @event Client#auth_failure
                 * @param {string} message
                 */
                this.emit(Events.AUTHENTICATION_FAILURE, failureEventPayload);
                await this.destroy();
                if (restart) {
                    // session restore failed so try again but without session to force new authentication
                    return this.initialize();
                }
                return;
            }

            // Register qr/code events
            if (pairWithPhoneNumber.phoneNumber) {
                await exposeFunctionIfAbsent(
                    this.pupPage,
                    'onCodeReceivedEvent',
                    async (code) => {
                        /**
                         * Emitted when a pairing code is received
                         * @event Client#code
                         * @param {string} code Code
                         * @returns {string} Code that was just received
                         */
                        this.emit(Events.CODE_RECEIVED, code);
                        return code;
                    },
                );
                this.requestPairingCode(
                    pairWithPhoneNumber.phoneNumber,
                    pairWithPhoneNumber.showNotification,
                    pairWithPhoneNumber.intervalMs,
                );
            } else {
                let qrRetries = 0;
                await exposeFunctionIfAbsent(
                    this.pupPage,
                    'onQRChangedEvent',
                    async (qr) => {
                        /**
                         * Emitted when a QR code is received
                         * @event Client#qr
                         * @param {string} qr QR Code
                         */
                        this.emit(Events.QR_RECEIVED, qr);
                        if (this.options.qrMaxRetries > 0) {
                            qrRetries++;
                            if (qrRetries > this.options.qrMaxRetries) {
                                this.emit(
                                    Events.DISCONNECTED,
                                    'Max qrcode retries reached',
                                );
                                await this.destroy();
                            }
                        }
                    },
                );

                await this.pupPage.evaluate(async () => {
                    const registrationInfo =
                        await window.AuthStore.RegistrationUtils.waSignalStore.getRegistrationInfo();
                    const noiseKeyPair =
                        await window.AuthStore.RegistrationUtils.waNoiseInfo.get();
                    const staticKeyB64 = window.AuthStore.Base64Tools.encodeB64(
                        noiseKeyPair.staticKeyPair.pubKey,
                    );
                    const identityKeyB64 =
                        window.AuthStore.Base64Tools.encodeB64(
                            registrationInfo.identityKeyPair.pubKey,
                        );
                    const platform =
                        window.AuthStore.RegistrationUtils.DEVICE_PLATFORM;
                    const getQR = (ref) =>
                        ref +
                        ',' +
                        staticKeyB64 +
                        ',' +
                        identityKeyB64 +
                        ',' +
                        window
                            .require('WAWebUserPrefsMultiDevice')
                            .getADVSecretKey() +
                        ',' +
                        platform;
                    window.onQRChangedEvent(getQR(window.AuthStore.Conn.ref)); // initial qr
                    window.AuthStore.Conn.on('change:ref', (_, ref) => {
                        window.onQRChangedEvent(getQR(ref));
                    }); // future QR changes
                });
            }
        }

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAuthAppStateChangedEvent',
            async (state) => {
                if (
                    state == 'UNPAIRED_IDLE' &&
                    !pairWithPhoneNumber.phoneNumber
                ) {
                    // refresh qr code
                    window.require('WAWebCmd').Cmd.refreshQR();
                }
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAppStateHasSyncedEvent',
            async () => {
                const authEventPayload =
                    await this.authStrategy.getAuthEventPayload();
                /**
                 * Emitted when authentication is successful
                 * @event Client#authenticated
                 */
                this.emit(Events.AUTHENTICATED, authEventPayload);

                const injected = await this.pupPage.evaluate(async () => {
                    return typeof window.WWebJS !== 'undefined';
                });

                if (!injected) {
                    if (
                        this.options.webVersionCache.type === 'local' &&
                        this.currentIndexHtml
                    ) {
                        const { type: webCacheType, ...webCacheOptions } =
                            this.options.webVersionCache;
                        const webCache = WebCacheFactory.createWebCache(
                            webCacheType,
                            webCacheOptions,
                        );

                        await webCache.persist(this.currentIndexHtml, version);
                    }

                    //Load util functions (serializers, helper functions)
                    await this.pupPage.evaluate(LoadUtils);

                    let start = Date.now();
                    let res = false;
                    while (start > Date.now() - 30000) {
                        // Check window.WWebJS Injection
                        res = await this.pupPage.evaluate(
                            'window.WWebJS != undefined',
                        );
                        if (res) {
                            break;
                        }
                        await new Promise((r) => setTimeout(r, 200));
                    }
                    if (!res) {
                        throw 'ready timeout';
                    }

                    /**
                     * Current connection information
                     * @type {ClientInfo}
                     */
                    this.info = new ClientInfo(
                        this,
                        await this.pupPage.evaluate(() => {
                            return {
                                ...window
                                    .require('WAWebConnModel')
                                    .Conn.serialize(),
                                wid:
                                    window
                                        .require('WAWebUserPrefsMeUser')
                                        .getMaybeMePnUser() ||
                                    window
                                        .require('WAWebUserPrefsMeUser')
                                        .getMaybeMeLidUser(),
                            };
                        }),
                    );

                    this.interface = new InterfaceController(this);

                    await this.attachEventListeners();
                }
                /**
                 * Emitted when the client has initialized and is ready to receive messages.
                 * @event Client#ready
                 */
                this.emit(Events.READY);
                this.authStrategy.afterAuthReady();
            },
        );
        let lastPercent = null;
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onOfflineProgressUpdateEvent',
            async (percent) => {
                if (lastPercent !== percent) {
                    lastPercent = percent;
                    this.emit(Events.LOADING_SCREEN, percent, 'WhatsApp'); // Message is hardcoded as "WhatsApp" for now
                }
            },
        );
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onLogoutEvent',
            async () => {
                this.lastLoggedOut = true;
                await this.pupPage
                    .waitForNavigation({ waitUntil: 'load', timeout: 5000 })
                    .catch((_) => _);
            },
        );
        await this.pupPage.evaluate(() => {
            window
                .require('WAWebSocketModel')
                .Socket.on('change:state', (_AppState, state) => {
                    window.onAuthAppStateChangedEvent(state);
                });
            window
                .require('WAWebSocketModel')
                .Socket.on('change:hasSynced', () => {
                    window.onAppStateHasSyncedEvent();
                });
            const Cmd = window.require('WAWebCmd').Cmd;
            Cmd.on('offline_progress_update_from_bridge', () => {
                window.onOfflineProgressUpdateEvent(
                    window.AuthStore.OfflineMessageHandler.getOfflineDeliveryProgress(),
                );
            });
            Cmd.on('logout', async () => {
                await window.onLogoutEvent();
            });
            Cmd.on('logout_from_bridge', async () => {
                await window.onLogoutEvent();
            });
        });
    }

    /**
     * Sets up events and requirements, kicks off authentication request
     */
    async initialize() {
        let /**
             * @type {puppeteer.Browser}
             */
            browser,
            /**
             * @type {puppeteer.Page}
             */
            page;

        browser = null;
        page = null;

        await this.authStrategy.beforeBrowserInitialized();

        const puppeteerOpts = this.options.puppeteer;
        if (
            puppeteerOpts &&
            (puppeteerOpts.browserWSEndpoint || puppeteerOpts.browserURL)
        ) {
            browser = await puppeteer.connect(puppeteerOpts);
            page = await browser.newPage();
        } else {
            const browserArgs = [...(puppeteerOpts.args || [])];
            if (
                this.options.userAgent !== false &&
                !browserArgs.find((arg) => arg.includes('--user-agent'))
            ) {
                browserArgs.push(`--user-agent=${this.options.userAgent}`);
            }
            // navigator.webdriver fix
            browserArgs.push('--disable-blink-features=AutomationControlled');

            browser = await puppeteer.launch({
                ...puppeteerOpts,
                args: browserArgs,
            });
            page = (await browser.pages())[0];
        }

        if (this.options.proxyAuthentication !== undefined) {
            await page.authenticate(this.options.proxyAuthentication);
        }
        if (this.options.userAgent !== false) {
            await page.setUserAgent(this.options.userAgent);
        }
        if (this.options.bypassCSP) await page.setBypassCSP(true);

        this.pupBrowser = browser;
        this.pupPage = page;

        await this.authStrategy.afterBrowserInitialized();
        await this.initWebVersionCache();

        if (this.options.evalOnNewDoc !== undefined) {
            await page.evaluateOnNewDocument(this.options.evalOnNewDoc);
        }

        await page.goto(WhatsWebURL, {
            waitUntil: 'load',
            timeout: 0,
            referer: 'https://whatsapp.com/',
        });

        await this.inject();

        this.pupPage.on('framenavigated', async (frame) => {
            if (frame.url().includes('post_logout=1') || this.lastLoggedOut) {
                this.emit(Events.DISCONNECTED, 'LOGOUT');
                await this.authStrategy.logout();
                await this.authStrategy.beforeBrowserInitialized();
                await this.authStrategy.afterBrowserInitialized();
                this.lastLoggedOut = false;
            }
            await this.inject();
        });
    }

    /**
     * Request authentication via pairing code instead of QR code
     * @param {string} phoneNumber - Phone number in international, symbol-free format (e.g. 12025550108 for US, 551155501234 for Brazil)
     * @param {boolean} [showNotification = true] - Show notification to pair on phone number
     * @param {number} [intervalMs = 180000] - The interval in milliseconds on how frequent to generate pairing code (WhatsApp default to 3 minutes)
     * @returns {Promise<string>} - Returns a pairing code in format "ABCDEFGH"
     */
    async requestPairingCode(
        phoneNumber,
        showNotification = true,
        intervalMs = 180000,
    ) {
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onCodeReceivedEvent',
            async (code) => {
                this.emit(Events.CODE_RECEIVED, code);
                return code;
            },
        );
        return await this.pupPage.evaluate(
            async (phoneNumber, showNotification, intervalMs) => {
                const getCode = async () => {
                    while (!window.AuthStore.PairingCodeLinkUtils) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 250),
                        );
                    }
                    window.AuthStore.PairingCodeLinkUtils.setPairingType(
                        'ALT_DEVICE_LINKING',
                    );
                    await window.AuthStore.PairingCodeLinkUtils.initializeAltDeviceLinking();
                    return window.AuthStore.PairingCodeLinkUtils.startAltLinkingFlow(
                        phoneNumber,
                        showNotification,
                    );
                };
                if (window.codeInterval) {
                    clearInterval(window.codeInterval); // remove existing interval
                }
                window.codeInterval = setInterval(async () => {
                    const state =
                        window.require('WAWebSocketModel').Socket.state;
                    if (state != 'UNPAIRED' && state != 'UNPAIRED_IDLE') {
                        clearInterval(window.codeInterval);
                        return;
                    }
                    window.onCodeReceivedEvent(await getCode());
                }, intervalMs);
                return window.onCodeReceivedEvent(await getCode());
            },
            phoneNumber,
            showNotification,
            intervalMs,
        );
    }

    /**
     * Cancels an active pairing code session and returns to QR code mode
     */
    async cancelPairingCode() {
        await this.pupPage.evaluate(async () => {
            if (window.codeInterval) {
                clearInterval(window.codeInterval);
                window.codeInterval = undefined;
            }
            window.require('WAWebLaunchSocketUtils').refreshQR();
            await window
                .require('WAWebAltDeviceLinkingApi')
                .initializeQRLinking();
        });
    }

    /**
     * Attach event listeners to WA Web
     * Private function
     * @property {boolean} reinject is this a reinject?
     */
    async attachEventListeners() {
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAddMessageEvent',
            (msg) => {
                if (msg.type === 'gp2') {
                    const notification = new GroupNotification(this, msg);
                    if (
                        ['add', 'invite', 'linked_group_join'].includes(
                            msg.subtype,
                        )
                    ) {
                        /**
                         * Emitted when a user joins the chat via invite link or is added by an admin.
                         * @event Client#group_join
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                        this.emit(Events.GROUP_JOIN, notification);
                    } else if (
                        msg.subtype === 'remove' ||
                        msg.subtype === 'leave'
                    ) {
                        /**
                         * Emitted when a user leaves the chat or is removed by an admin.
                         * @event Client#group_leave
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                        this.emit(Events.GROUP_LEAVE, notification);
                    } else if (
                        msg.subtype === 'promote' ||
                        msg.subtype === 'demote'
                    ) {
                        /**
                         * Emitted when a current user is promoted to an admin or demoted to a regular user.
                         * @event Client#group_admin_changed
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                        this.emit(Events.GROUP_ADMIN_CHANGED, notification);
                    } else if (msg.subtype === 'membership_approval_request') {
                        /**
                         * Emitted when some user requested to join the group
                         * that has the membership approval mode turned on
                         * @event Client#group_membership_request
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         * @param {string} notification.chatId The group ID the request was made for
                         * @param {string} notification.author The user ID that made a request
                         * @param {number} notification.timestamp The timestamp the request was made at
                         */
                        this.emit(
                            Events.GROUP_MEMBERSHIP_REQUEST,
                            notification,
                        );
                    } else {
                        /**
                         * Emitted when group settings are updated, such as subject, description or picture.
                         * @event Client#group_update
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                        this.emit(Events.GROUP_UPDATE, notification);
                    }
                    return;
                }

                const message = new Message(this, msg);

                /**
                 * Emitted when a new message is created, which may include the current user's own messages.
                 * @event Client#message_create
                 * @param {Message} message The message that was created
                 */
                this.emit(Events.MESSAGE_CREATE, message);

                if (msg.id.fromMe) return;

                /**
                 * Emitted when a new message is received.
                 * @event Client#message
                 * @param {Message} message The message that was received
                 */
                this.emit(Events.MESSAGE_RECEIVED, message);
            },
        );

        let last_message;

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onChangeMessageTypeEvent',
            (msg) => {
                if (msg.type === 'revoked') {
                    const message = new Message(this, msg);
                    let revoked_msg;
                    if (last_message && msg.id.id === last_message.id.id) {
                        revoked_msg = new Message(this, last_message);

                        if (message.protocolMessageKey)
                            revoked_msg.id = { ...message.protocolMessageKey };
                    }

                    /**
                     * Emitted when a message is deleted for everyone in the chat.
                     * @event Client#message_revoke_everyone
                     * @param {Message} message The message that was revoked, in its current state. It will not contain the original message's data.
                     * @param {?Message} revoked_msg The message that was revoked, before it was revoked. It will contain the message's original data.
                     * Note that due to the way this data is captured, it may be possible that this param will be undefined.
                     */
                    this.emit(
                        Events.MESSAGE_REVOKED_EVERYONE,
                        message,
                        revoked_msg,
                    );
                }
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onChangeMessageEvent',
            (msg) => {
                if (msg.type !== 'revoked') {
                    last_message = msg;
                }

                /**
                 * The event notification that is received when one of
                 * the group participants changes their phone number.
                 */
                const isParticipant =
                    msg.type === 'gp2' && msg.subtype === 'modify';

                /**
                 * The event notification that is received when one of
                 * the contacts changes their phone number.
                 */
                const isContact =
                    msg.type === 'notification_template' &&
                    msg.subtype === 'change_number';

                if (isParticipant || isContact) {
                    /** @type {GroupNotification} object does not provide enough information about this event, so a @type {Message} object is used. */
                    const message = new Message(this, msg);

                    const newId = isParticipant ? msg.recipients[0] : msg.to;
                    const oldId = isParticipant
                        ? msg.author
                        : msg.templateParams.find((id) => id !== newId);

                    /**
                     * Emitted when a contact or a group participant changes their phone number.
                     * @event Client#contact_changed
                     * @param {Message} message Message with more information about the event.
                     * @param {String} oldId The user's id (an old one) who changed their phone number
                     * and who triggered the notification.
                     * @param {String} newId The user's new id after the change.
                     * @param {Boolean} isContact Indicates if a contact or a group participant changed their phone number.
                     */
                    this.emit(
                        Events.CONTACT_CHANGED,
                        message,
                        oldId,
                        newId,
                        isContact,
                    );
                }
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onRemoveMessageEvent',
            (msg) => {
                if (!msg.isNewMsg) return;

                const message = new Message(this, msg);

                /**
                 * Emitted when a message is deleted by the current user.
                 * @event Client#message_revoke_me
                 * @param {Message} message The message that was revoked
                 */
                this.emit(Events.MESSAGE_REVOKED_ME, message);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onMessageAckEvent',
            (msg, ack) => {
                const message = new Message(this, msg);

                /**
                 * Emitted when an ack event occurrs on message type.
                 * @event Client#message_ack
                 * @param {Message} message The message that was affected
                 * @param {MessageAck} ack The new ACK value
                 */
                this.emit(Events.MESSAGE_ACK, message, ack);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onChatUnreadCountEvent',
            async (data) => {
                const chat = await this.getChatById(data.id);

                /**
                 * Emitted when the chat unread count changes
                 */
                this.emit(Events.UNREAD_COUNT, chat);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onMessageMediaUploadedEvent',
            (msg) => {
                const message = new Message(this, msg);

                /**
                 * Emitted when media has been uploaded for a message sent by the client.
                 * @event Client#media_uploaded
                 * @param {Message} message The message with media that was uploaded
                 */
                this.emit(Events.MEDIA_UPLOADED, message);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAppStateChangedEvent',
            async (state) => {
                /**
                 * Emitted when the connection state changes
                 * @event Client#change_state
                 * @param {WAState} state the new connection state
                 */
                this.emit(Events.STATE_CHANGED, state);

                const ACCEPTED_STATES = [
                    WAState.CONNECTED,
                    WAState.OPENING,
                    WAState.PAIRING,
                    WAState.TIMEOUT,
                ];

                if (this.options.takeoverOnConflict) {
                    ACCEPTED_STATES.push(WAState.CONFLICT);

                    if (state === WAState.CONFLICT) {
                        setTimeout(() => {
                            this.pupPage.evaluate(() =>
                                window
                                    .require('WAWebSocketModel')
                                    .Socket.takeover(),
                            );
                        }, this.options.takeoverTimeoutMs);
                    }
                }

                if (!ACCEPTED_STATES.includes(state)) {
                    /**
                     * Emitted when the client has been disconnected
                     * @event Client#disconnected
                     * @param {WAState|"LOGOUT"} reason reason that caused the disconnect
                     */
                    await this.authStrategy.disconnect();
                    this.emit(Events.DISCONNECTED, state);
                    this.destroy();
                }
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onBatteryStateChangedEvent',
            (state) => {
                const { battery, plugged } = state;

                if (battery === undefined) return;

                /**
                 * Emitted when the battery percentage for the attached device changes. Will not be sent if using multi-device.
                 * @event Client#change_battery
                 * @param {object} batteryInfo
                 * @param {number} batteryInfo.battery - The current battery percentage
                 * @param {boolean} batteryInfo.plugged - Indicates if the phone is plugged in (true) or not (false)
                 * @deprecated
                 */
                this.emit(Events.BATTERY_CHANGED, { battery, plugged });
            },
        );

        await exposeFunctionIfAbsent(this.pupPage, 'onIncomingCall', (call) => {
            /**
             * Emitted when a call is received
             * @event Client#incoming_call
             * @param {object} call
             * @param {number} call.id - Call id
             * @param {string} call.peerJid - Who called
             * @param {boolean} call.isVideo - if is video
             * @param {boolean} call.isGroup - if is group
             * @param {boolean} call.canHandleLocally - if we can handle in waweb
             * @param {boolean} call.outgoing - if is outgoing
             * @param {boolean} call.webClientShouldHandle - If Waweb should handle
             * @param {object} call.participants - Participants
             */
            const cll = new Call(this, call);
            this.emit(Events.INCOMING_CALL, cll);
        });

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onReaction',
            (reactions) => {
                for (const reaction of reactions) {
                    /**
                     * Emitted when a reaction is sent, received, updated or removed
                     * @event Client#message_reaction
                     * @param {object} reaction
                     * @param {object} reaction.id - Reaction id
                     * @param {number} reaction.orphan - Orphan
                     * @param {?string} reaction.orphanReason - Orphan reason
                     * @param {number} reaction.timestamp - Timestamp
                     * @param {string} reaction.reaction - Reaction
                     * @param {boolean} reaction.read - Read
                     * @param {object} reaction.msgId - Parent message id
                     * @param {string} reaction.senderId - Sender id
                     * @param {?number} reaction.ack - Ack
                     */

                    this.emit(
                        Events.MESSAGE_REACTION,
                        new Reaction(this, reaction),
                    );
                }
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onRemoveChatEvent',
            async (chat) => {
                const _chat = await this.getChatById(chat.id);

                /**
                 * Emitted when a chat is removed
                 * @event Client#chat_removed
                 * @param {Chat} chat
                 */
                this.emit(Events.CHAT_REMOVED, _chat);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onArchiveChatEvent',
            async (chat, currState, prevState) => {
                const _chat = await this.getChatById(chat.id);

                /**
                 * Emitted when a chat is archived/unarchived
                 * @event Client#chat_archived
                 * @param {Chat} chat
                 * @param {boolean} currState
                 * @param {boolean} prevState
                 */
                this.emit(Events.CHAT_ARCHIVED, _chat, currState, prevState);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onEditMessageEvent',
            (msg, newBody, prevBody) => {
                if (msg.type === 'revoked') {
                    return;
                }
                /**
                 * Emitted when messages are edited
                 * @event Client#message_edit
                 * @param {Message} message
                 * @param {string} newBody
                 * @param {string} prevBody
                 */
                this.emit(
                    Events.MESSAGE_EDIT,
                    new Message(this, msg),
                    newBody,
                    prevBody,
                );
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAddMessageCiphertextEvent',
            (msg) => {
                /**
                 * Emitted when a message is received as ciphertext (not yet decrypted)
                 * @event Client#message_ciphertext
                 * @param {Message} message
                 */
                this.emit(Events.MESSAGE_CIPHERTEXT, new Message(this, msg));
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onCiphertextFailedEvent',
            (msg) => {
                /**
                 * Emitted when a ciphertext message failed to decrypt after recovery attempt
                 * @event Client#message_ciphertext_failed
                 * @param {Message} message
                 */
                this.emit(
                    Events.MESSAGE_CIPHERTEXT_FAILED,
                    new Message(this, msg),
                );
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onPollVoteEvent',
            (votes) => {
                for (const vote of votes) {
                    /**
                     * Emitted when some poll option is selected or deselected,
                     * shows a user's current selected option(s) on the poll
                     * @event Client#vote_update
                     */
                    this.emit(Events.VOTE_UPDATE, new PollVote(this, vote));
                }
            },
        );

        await this.pupPage.evaluate(() => {
            const { Msg, Chat, WAWebCallCollection } =
                window.require('WAWebCollections');
            const AppState = window.require('WAWebSocketModel').Socket;

            // Enable placeholder message resend (recovery for ciphertext messages)
            const gatingUtils = window.require('WAWebSyncGatingUtils');
            gatingUtils.isPlaceholderMessageResendEnabled = () => true;

            Msg.on('change', (msg) => {
                window.onChangeMessageEvent(window.WWebJS.getMessageModel(msg));
            });
            Msg.on('change:type', (msg) => {
                window.onChangeMessageTypeEvent(
                    window.WWebJS.getMessageModel(msg),
                );
            });
            Msg.on('change:ack', (msg, ack) => {
                window.onMessageAckEvent(
                    window.WWebJS.getMessageModel(msg),
                    ack,
                );
            });
            Msg.on('change:isUnsentMedia', (msg, unsent) => {
                if (msg.id.fromMe && !unsent)
                    window.onMessageMediaUploadedEvent(
                        window.WWebJS.getMessageModel(msg),
                    );
            });
            Msg.on('remove', (msg) => {
                if (msg.isNewMsg)
                    window.onRemoveMessageEvent(
                        window.WWebJS.getMessageModel(msg),
                    );
            });
            Msg.on('change:body change:caption', (msg, newBody, prevBody) => {
                window.onEditMessageEvent(
                    window.WWebJS.getMessageModel(msg),
                    newBody,
                    prevBody,
                );
            });
            AppState.on('change:state', (_AppState, state) => {
                window.onAppStateChangedEvent(state);
            });
            window
                .require('WAWebConnModel')
                .Conn.on('change:battery', (state) => {
                    window.onBatteryStateChangedEvent(state);
                });
            if (
                WAWebCallCollection &&
                typeof WAWebCallCollection.on === 'function'
            ) {
                WAWebCallCollection.on('add', (call) => {
                    window.onIncomingCall(call);
                });
            }
            Chat.on('remove', async (chat) => {
                window.onRemoveChatEvent(
                    await window.WWebJS.getChatModel(chat),
                );
            });
            Chat.on('change:archive', async (chat, currState, prevState) => {
                window.onArchiveChatEvent(
                    await window.WWebJS.getChatModel(chat),
                    currState,
                    prevState,
                );
            });
            const pendingResend = new Set();
            let resendFlush = null;

            function requestResend(msg) {
                pendingResend.add(msg);
                if (resendFlush) return;
                resendFlush = setTimeout(() => {
                    resendFlush = null;
                    const msgs = [...pendingResend];
                    pendingResend.clear();
                    if (msgs.length === 0) return;
                    window
                        .require(
                            'WAWebNonMessageDataRequestPlaceholderMessageResendUtils',
                        )
                        .handlePlaceholderMsgsSeen(msgs, true);
                }, 5000);
            }

            Msg.on('add', (msg) => {
                if (!msg.isNewMsg) return;

                if (msg.type !== 'ciphertext') {
                    window.onAddMessageEvent(
                        window.WWebJS.getMessageModel(msg),
                    );
                    return;
                }

                window.onAddMessageCiphertextEvent(
                    window.WWebJS.getMessageModel(msg),
                );

                if (msg.subtype && msg.subtype.endsWith('_unavailable_fanout'))
                    return;

                requestResend(msg);

                const failTimer = setTimeout(() => {
                    if (msg.type !== 'ciphertext') return;
                    window.onCiphertextFailedEvent(
                        window.WWebJS.getMessageModel(msg),
                    );
                }, 15000);

                msg.once('change:type', (_msg) => {
                    clearTimeout(failTimer);
                    pendingResend.delete(_msg);
                    if (_msg.type === 'revoked') return;
                    window.onAddMessageEvent(
                        window.WWebJS.getMessageModel(_msg),
                    );
                });
            });
            Chat.on('change:unreadCount', (chat) => {
                window.onChatUnreadCountEvent(chat);
            });

            window.WWebJS.injectToFunction(
                {
                    module: 'WAWebAddonReactionTableMode',
                    function: 'reactionTableMode.bulkUpsert',
                },
                (module, origFunction, ...args) => {
                    window.onReaction(
                        args[0].map((reaction) => {
                            const msgKey = reaction.id;
                            const parentMsgKey = reaction.reactionParentKey;
                            const timestamp = reaction.reactionTimestamp / 1000;
                            const sender = reaction.author ?? reaction.from;
                            const senderUserJid = sender._serialized;

                            return {
                                ...reaction,
                                msgKey,
                                parentMsgKey,
                                senderUserJid,
                                timestamp,
                            };
                        }),
                    );

                    return origFunction.apply(module, args);
                },
            );

            window.WWebJS.injectToFunction(
                {
                    module: 'WAWebAddonPollVoteTableMode',
                    function: 'pollVoteTableMode.bulkUpsert',
                },
                async (module, origFunction, ...args) => {
                    const votes = await Promise.all(
                        args[0].map(async (vote) => {
                            const msgKey = vote.id;
                            const parentMsgKey = vote.pollUpdateParentKey;
                            const timestamp = vote.t / 1000;
                            const sender = vote.author ?? vote.from;
                            const senderUserJid = sender._serialized;

                            let parentMessage = Msg.get(
                                parentMsgKey._serialized,
                            );
                            if (!parentMessage) {
                                const fetched = await Msg.getMessagesById([
                                    parentMsgKey._serialized,
                                ]);
                                parentMessage = fetched?.messages?.[0] || null;
                            }

                            return {
                                ...vote,
                                msgKey,
                                sender,
                                parentMsgKey,
                                senderUserJid,
                                timestamp,
                                parentMessage,
                            };
                        }),
                    );

                    window.onPollVoteEvent(votes);

                    return origFunction.apply(module, args);
                },
            );
        });
    }

    async initWebVersionCache() {
        const { type: webCacheType, ...webCacheOptions } =
            this.options.webVersionCache;
        const webCache = WebCacheFactory.createWebCache(
            webCacheType,
            webCacheOptions,
        );

        const requestedVersion = this.options.webVersion;
        const versionContent = await webCache.resolve(requestedVersion);

        if (versionContent) {
            await this.pupPage.setRequestInterception(true);
            this.pupPage.on('request', async (req) => {
                if (req.url() === WhatsWebURL) {
                    req.respond({
                        status: 200,
                        contentType: 'text/html',
                        body: versionContent,
                    });
                } else {
                    req.continue();
                }
            });
        } else {
            this.pupPage.on('response', async (res) => {
                if (res.ok() && res.url() === WhatsWebURL) {
                    const indexHtml = await res.text();
                    this.currentIndexHtml = indexHtml;
                }
            });
        }
    }

    /**
     * Closes the client
     */
    async destroy() {
        const browser = this.pupBrowser;
        const isConnected = browser?.isConnected?.();
        if (isConnected) {
            await browser.close();
        }
        await this.authStrategy.destroy();
    }

    /**
     * Logs out the client, closing the current session
     */
    async logout() {
        await this.pupPage.evaluate(() => {
            return window.require('WAWebSocketModel').Socket.logout();
        });
        await this.pupBrowser.close();

        let maxDelay = 0;
        while (this.pupBrowser.isConnected() && maxDelay < 10) {
            // waits a maximum of 1 second before calling the AuthStrategy
            await new Promise((resolve) => setTimeout(resolve, 100));
            maxDelay++;
        }

        await this.authStrategy.logout();
    }

    /**
     * Returns the version of WhatsApp Web currently being run
     * @returns {Promise<string>}
     */
    async getWWebVersion() {
        return await this.pupPage.evaluate(() => {
            return window.Debug.VERSION;
        });
    }

    async setDeviceName(deviceName, browserName) {
        (deviceName || browserName) &&
            (await this.pupPage.evaluate(
                (deviceName, browserName) => {
                    const func = window.require('WAWebMiscBrowserUtils').info;
                    window.require('WAWebMiscBrowserUtils').info = () => {
                        return {
                            ...func(),
                            ...(deviceName ? { os: deviceName } : {}),
                            ...(browserName ? { name: browserName } : {}),
                        };
                    };
                },
                deviceName,
                browserName,
            ));
    }

    /**
     * Mark as seen for the Chat
     *  @param {string} chatId
     *  @returns {Promise<boolean>} result
     *
     */
    async sendSeen(chatId) {
        return await this.pupPage.evaluate(async (chatId) => {
            return window.WWebJS.sendSeen(chatId);
        }, chatId);
    }

    /**
     * An object representing mentions of groups
     * @typedef {Object} GroupMention
     * @property {string} subject - The name of a group to mention (can be custom)
     * @property {string} id - The group ID, e.g.: 'XXXXXXXXXX@g.us'
     */

    /**
     * Message options.
     * @typedef {Object} MessageSendOptions
     * @property {boolean} [linkPreview=true] - Show links preview. Has no effect on multi-device accounts.
     * @property {boolean} [sendAudioAsVoice=false] - Send audio as voice message with a generated waveform
     * @property {boolean} [sendVideoAsGif=false] - Send video as gif
     * @property {boolean} [sendMediaAsSticker=false] - Send media as a sticker
     * @property {boolean} [sendMediaAsDocument=false] - Send media as a document
     * @property {boolean} [sendMediaAsHd=false] - Send image as quality HD
     * @property {boolean} [isViewOnce=false] - Send photo/video as a view once message
     * @property {boolean} [parseVCards=true] - Automatically parse vCards and send them as contacts
     * @property {string} [caption] - Image or video caption
     * @property {string} [quotedMessageId] - Id of the message that is being quoted (or replied to)
     * @property {GroupMention[]} [groupMentions] - An array of object that handle group mentions
     * @property {string[]} [mentions] - User IDs to mention in the message
     * @property {boolean} [sendSeen=true] - Mark the conversation as seen after sending the message
     * @property {string} [invokedBotWid=undefined] - Bot Wid when doing a bot mention like @Meta AI
     * @property {string} [stickerAuthor=undefined] - Sets the author of the sticker, (if sendMediaAsSticker is true).
     * @property {string} [stickerName=undefined] - Sets the name of the sticker, (if sendMediaAsSticker is true).
     * @property {string[]} [stickerCategories=undefined] - Sets the categories of the sticker, (if sendMediaAsSticker is true). Provide emoji char array, can be null.
     * @property {boolean} [ignoreQuoteErrors = true] - Should the bot send a quoted message without the quoted message if it fails to get the quote?
     * @property {boolean} [waitUntilMsgSent = false] - Should the bot wait for the message send result?
     * @property {MessageMedia} [media] - Media to be sent
     * @property {any} [extra] - Extra options
     */

    /**
     * Send a message to a specific chatId
     * @param {string} chatId
     * @param {string|MessageMedia|Location|Poll|Contact|Array<Contact>|Buttons|List} content
     * @param {MessageSendOptions} [options] - Options used when sending the message
     *
     * @returns {Promise<Message>} Message that was just sent
     */
    async sendMessage(chatId, content, options = {}) {
        const isChannel = /@\w*newsletter\b/.test(chatId);
        const isStatus = /@\w*broadcast\b/.test(chatId);

        if (
            isChannel &&
            [
                options.sendMediaAsDocument,
                options.quotedMessageId,
                options.parseVCards,
                options.isViewOnce,
                content instanceof Location,
                content instanceof Contact,
                content instanceof Buttons,
                content instanceof List,
                Array.isArray(content) &&
                    content.length > 0 &&
                    content[0] instanceof Contact,
            ].includes(true)
        ) {
            console.warn(
                'The message type is currently not supported for sending in channels,\nthe supported message types are: text, image, sticker, gif, video, voice and poll.',
            );
            return null;
        } else if (
            isStatus &&
            [
                options.sendMediaAsDocument,
                options.quotedMessageId,
                options.parseVCards,
                options.isViewOnce,
                options.sendMediaAsSticker,
                content instanceof Location,
                content instanceof Contact,
                content instanceof Poll,
                content instanceof Buttons,
                content instanceof List,
                Array.isArray(content) &&
                    content.length > 0 &&
                    content[0] instanceof Contact,
            ].includes(true)
        ) {
            console.warn(
                'The message type is currently not supported for sending in status broadcast,\nthe supported message types are: text, image, gif, audio and video.',
            );
            return null;
        }

        if (options.mentions) {
            !Array.isArray(options.mentions) &&
                (options.mentions = [options.mentions]);
            if (
                options.mentions.some(
                    (possiblyContact) => possiblyContact instanceof Contact,
                )
            ) {
                console.warn(
                    'Mentions with an array of Contact are now deprecated. See more at https://github.com/pedroslopez/whatsapp-web.js/pull/2166.',
                );
                options.mentions = options.mentions.map(
                    (a) => a.id._serialized,
                );
            }
        }

        options.groupMentions &&
            !Array.isArray(options.groupMentions) &&
            (options.groupMentions = [options.groupMentions]);

        let internalOptions = {
            linkPreview: options.linkPreview === false ? undefined : true,
            sendAudioAsVoice: options.sendAudioAsVoice,
            sendVideoAsGif: options.sendVideoAsGif,
            sendMediaAsSticker: options.sendMediaAsSticker,
            sendMediaAsDocument: options.sendMediaAsDocument,
            sendMediaAsHd: options.sendMediaAsHd,
            caption: options.caption,
            isCaptionByUser: options.caption ? true : false,
            quotedMessageId: options.quotedMessageId,
            parseVCards: options.parseVCards !== false,
            mentionedJidList: options.mentions || [],
            groupMentions: options.groupMentions,
            invokedBotWid: options.invokedBotWid,
            ignoreQuoteErrors: options.ignoreQuoteErrors !== false,
            waitUntilMsgSent: options.waitUntilMsgSent || false,
            extraOptions: options.extra,
        };

        const sendSeen = options.sendSeen !== false;

        if (content instanceof MessageMedia) {
            internalOptions.media = content;
            ((internalOptions.isViewOnce = options.isViewOnce), (content = ''));
        } else if (options.media instanceof MessageMedia) {
            internalOptions.media = options.media;
            internalOptions.caption = content;
            ((internalOptions.isViewOnce = options.isViewOnce), (content = ''));
        } else if (content instanceof Location) {
            internalOptions.location = content;
            content = '';
        } else if (content instanceof Poll) {
            internalOptions.poll = content;
            content = '';
        } else if (content instanceof ScheduledEvent) {
            internalOptions.event = content;
            content = '';
        } else if (content instanceof Contact) {
            internalOptions.contactCard = content.id._serialized;
            content = '';
        } else if (
            Array.isArray(content) &&
            content.length > 0 &&
            content[0] instanceof Contact
        ) {
            internalOptions.contactCardList = content.map(
                (contact) => contact.id._serialized,
            );
            content = '';
        } else if (content instanceof Buttons) {
            console.warn(
                'Buttons are now deprecated. See more at https://www.youtube.com/watch?v=hv1R1rLeVVE.',
            );
            if (content.type !== 'chat') {
                internalOptions.attachment = content.body;
            }
            internalOptions.buttons = content;
            content = '';
        } else if (content instanceof List) {
            console.warn(
                'Lists are now deprecated. See more at https://www.youtube.com/watch?v=hv1R1rLeVVE.',
            );
            internalOptions.list = content;
            content = '';
        }

        if (internalOptions.sendMediaAsSticker && internalOptions.media) {
            internalOptions.media = await Util.formatToWebpSticker(
                internalOptions.media,
                {
                    name: options.stickerName,
                    author: options.stickerAuthor,
                    categories: options.stickerCategories,
                },
                this.pupPage,
            );
        }

        const sentMsg = await this.pupPage.evaluate(
            async (chatId, content, options, sendSeen) => {
                const chat = await window.WWebJS.getChat(chatId, {
                    getAsModel: false,
                });

                if (!chat) return null;

                if (sendSeen) {
                    await window.WWebJS.sendSeen(chatId);
                }

                const msg = await window.WWebJS.sendMessage(
                    chat,
                    content,
                    options,
                );
                return msg ? window.WWebJS.getMessageModel(msg) : undefined;
            },
            chatId,
            content,
            internalOptions,
            sendSeen,
        );

        return sentMsg ? new Message(this, sentMsg) : undefined;
    }

    /**
     * Send an emoji reaction to a specific message
     * @param {string} messageId - Id of the message to add the reaction.
     * @param {string} reaction  - Emoji to react with. Send an empty string to remove the reaction.
     * @return {Promise}
     */
    async sendReaction(messageId, reaction) {
        await this.pupPage.evaluate(
            async (messageId, reaction) => {
                if (!messageId) return null;
                const msg =
                    window.require('WAWebCollections').Msg.get(messageId) ||
                    (
                        await window
                            .require('WAWebCollections')
                            .Msg.getMessagesById([messageId])
                    )?.messages?.[0];
                if (!msg) return null;
                await window
                    .require('WAWebSendReactionMsgAction')
                    .sendReactionToMsg(msg, reaction);
            },
            messageId,
            reaction,
        );
    }

    /**
     * @typedef {Object} SendChannelAdminInviteOptions
     * @property {?string} comment The comment to be added to an invitation
     */

    /**
     * Sends a channel admin invitation to a user, allowing them to become an admin of the channel
     * @param {string} chatId The ID of a user to send the channel admin invitation to
     * @param {string} channelId The ID of a channel for which the invitation is being sent
     * @param {SendChannelAdminInviteOptions} options
     * @returns {Promise<boolean>} Returns true if an invitation was sent successfully, false otherwise
     */
    async sendChannelAdminInvite(chatId, channelId, options = {}) {
        const response = await this.pupPage.evaluate(
            async (chatId, channelId, options) => {
                const { createWid } = window.require('WAWebWidFactory');
                const channelWid = createWid(channelId);
                const chatWid = createWid(chatId);
                const chat =
                    window.require('WAWebCollections').Chat.get(chatWid) ||
                    (await window
                        .require('WAWebCollections')
                        .Chat.find(chatWid));

                if (!chatWid.isUser()) {
                    return false;
                }

                return await window
                    .require('WAWebNewsletterSendMsgAction')
                    .sendNewsletterAdminInviteMessage(chat, {
                        newsletterWid: channelWid,
                        invitee: chatWid,
                        inviteMessage: options.comment,
                        base64Thumb:
                            await window.WWebJS.getProfilePicThumbToBase64(
                                channelWid,
                            ),
                    });
            },
            chatId,
            channelId,
            options,
        );

        return response.messageSendResult === 'OK';
    }

    /**
     * Searches for messages
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @param {string} [options.chatId]
     * @returns {Promise<Message[]>}
     */
    async searchMessages(query, options = {}) {
        const messages = await this.pupPage.evaluate(
            async (query, page, count, remote) => {
                const { messages } = await window
                    .require('WAWebCollections')
                    .Msg.search(query, page, count, remote);
                return messages.map((msg) =>
                    window.WWebJS.getMessageModel(msg),
                );
            },
            query,
            options.page,
            options.limit,
            options.chatId,
        );

        return messages.map((msg) => new Message(this, msg));
    }

    /**
     * Get all current chat instances
     * @returns {Promise<Array<Chat>>}
     */
    async getChats() {
        const chats = await this.pupPage.evaluate(async () => {
            return await window.WWebJS.getChats();
        });

        return chats.map((chat) => ChatFactory.create(this, chat));
    }

    /**
     * Gets all cached {@link Channel} instance
     * @returns {Promise<Array<Channel>>}
     */
    async getChannels() {
        const channels = await this.pupPage.evaluate(async () => {
            return await window.WWebJS.getChannels();
        });

        return channels.map((channel) => ChatFactory.create(this, channel));
    }

    /**
     * Gets chat or channel instance by ID
     * @param {string} chatId
     * @returns {Promise<Chat|Channel>}
     */
    async getChatById(chatId) {
        const chat = await this.pupPage.evaluate(async (chatId) => {
            return await window.WWebJS.getChat(chatId);
        }, chatId);
        return chat ? ChatFactory.create(this, chat) : undefined;
    }

    /**
     * Gets a {@link Channel} instance by invite code
     * @param {string} inviteCode The code that comes after the 'https://whatsapp.com/channel/'
     * @returns {Promise<Channel>}
     */
    async getChannelByInviteCode(inviteCode) {
        const channel = await this.pupPage.evaluate(async (inviteCode) => {
            let channelMetadata;
            try {
                channelMetadata =
                    await window.WWebJS.getChannelMetadata(inviteCode);
            } catch (err) {
                if (err.name === 'ServerStatusCodeError') return null;
                throw err;
            }
            return await window.WWebJS.getChat(channelMetadata.id);
        }, inviteCode);

        return channel ? ChatFactory.create(this, channel) : undefined;
    }

    /**
     * Get all current contact instances
     * @returns {Promise<Array<Contact>>}
     */
    async getContacts() {
        let contacts = await this.pupPage.evaluate(() => {
            return window.WWebJS.getContacts();
        });

        return contacts.map((contact) => ContactFactory.create(this, contact));
    }

    /**
     * Get contact instance by ID
     * @param {string} contactId
     * @returns {Promise<Contact>}
     */
    async getContactById(contactId) {
        let contact = await this.pupPage.evaluate((contactId) => {
            return window.WWebJS.getContact(contactId);
        }, contactId);

        return ContactFactory.create(this, contact);
    }

    /**
     * Get message by ID
     * @param {string} messageId
     * @returns {Promise<Message>}
     */
    async getMessageById(messageId) {
        const msg = await this.pupPage.evaluate(async (messageId) => {
            let msg = window.require('WAWebCollections').Msg.get(messageId);
            if (msg) return window.WWebJS.getMessageModel(msg);

            const params = messageId.split('_');
            if (params.length !== 3 && params.length !== 4)
                throw new Error('Invalid serialized message id specified');

            let messagesObject = await window
                .require('WAWebCollections')
                .Msg.getMessagesById([messageId]);
            if (messagesObject && messagesObject.messages.length)
                msg = messagesObject.messages[0];

            if (msg) return window.WWebJS.getMessageModel(msg);
        }, messageId);

        if (msg) return new Message(this, msg);
        return null;
    }

    /**
     * Gets instances of all pinned messages in a chat
     * @param {string} chatId The chat ID
     * @returns {Promise<Array<Message>>}
     */
    async getPinnedMessages(chatId) {
        const pinnedMsgs = await this.pupPage.evaluate(async (chatId) => {
            const chatWid = window.require('WAWebWidFactory').createWid(chatId);
            const chat =
                window.require('WAWebCollections').Chat.get(chatWid) ??
                (await window.require('WAWebCollections').Chat.find(chatWid));
            if (!chat) return [];

            const msgs = await window
                .require('WAWebPinInChatSchema')
                .getTable()
                .equals(['chatId'], chatWid.toString());

            const pinnedMsgs = (
                await Promise.all(
                    msgs
                        .filter((msg) => msg.pinType == 1)
                        .map(async (msg) => {
                            const res = await window
                                .require('WAWebCollections')
                                .Msg.getMessagesById([msg.parentMsgKey]);
                            return res?.messages?.[0];
                        }),
                )
            ).filter(Boolean);

            return !pinnedMsgs.length
                ? []
                : await Promise.all(
                      pinnedMsgs.map((msg) =>
                          window.WWebJS.getMessageModel(msg),
                      ),
                  );
        }, chatId);

        return pinnedMsgs.map((msg) => new Message(this, msg));
    }

    /**
     * Returns an object with information about the invite code's group
     * @param {string} inviteCode
     * @returns {Promise<object>} Invite information
     */
    async getInviteInfo(inviteCode) {
        return await this.pupPage.evaluate((inviteCode) => {
            return window
                .require('WAWebGroupQueryJob')
                .queryGroupInvite(inviteCode);
        }, inviteCode);
    }

    /**
     * Accepts an invitation to join a group
     * @param {string} inviteCode Invitation code
     * @returns {Promise<string>} Id of the joined Chat
     */
    async acceptInvite(inviteCode) {
        const res = await this.pupPage.evaluate(async (inviteCode) => {
            return await window
                .require('WAWebGroupInviteJob')
                .joinGroupViaInvite(inviteCode);
        }, inviteCode);

        return res.gid._serialized;
    }

    /**
     * Accepts a channel admin invitation and promotes the current user to a channel admin
     * @param {string} channelId The channel ID to accept the admin invitation from
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async acceptChannelAdminInvite(channelId) {
        return await this.pupPage.evaluate(async (channelId) => {
            try {
                await window
                    .require('WAWebMexAcceptNewsletterAdminInviteJob')
                    .acceptNewsletterAdminInvite(channelId);
                return true;
            } catch (err) {
                if (err.name === 'ServerStatusCodeError') return false;
                throw err;
            }
        }, channelId);
    }

    /**
     * Revokes a channel admin invitation sent to a user by a channel owner
     * @param {string} channelId The channel ID an invitation belongs to
     * @param {string} userId The user ID the invitation was sent to
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async revokeChannelAdminInvite(channelId, userId) {
        return await this.pupPage.evaluate(
            async (channelId, userId) => {
                try {
                    const userWid = window
                        .require('WAWebWidFactory')
                        .createWid(userId);
                    await window
                        .require('WAWebMexRevokeNewsletterAdminInviteJob')
                        .revokeNewsletterAdminInvite(channelId, userWid);
                    return true;
                } catch (err) {
                    if (err.name === 'ServerStatusCodeError') return false;
                    throw err;
                }
            },
            channelId,
            userId,
        );
    }

    /**
     * Demotes a channel admin to a regular subscriber (can be used also for self-demotion)
     * @param {string} channelId The channel ID to demote an admin in
     * @param {string} userId The user ID to demote
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async demoteChannelAdmin(channelId, userId) {
        return await this.pupPage.evaluate(
            async (channelId, userId) => {
                try {
                    const userWid = window
                        .require('WAWebWidFactory')
                        .createWid(userId);
                    await window
                        .require('WAWebDemoteNewsletterAdminAction')
                        .demoteNewsletterAdmin(channelId, userWid);
                    return true;
                } catch (err) {
                    if (err.name === 'ServerStatusCodeError') return false;
                    throw err;
                }
            },
            channelId,
            userId,
        );
    }

    /**
     * Accepts a private invitation to join a group
     * @param {object} inviteInfo Invite V4 Info
     * @returns {Promise<Object>}
     */
    async acceptGroupV4Invite(inviteInfo) {
        if (!inviteInfo.inviteCode)
            throw 'Invalid invite code, try passing the message.inviteV4 object';
        if (inviteInfo.inviteCodeExp == 0) throw 'Expired invite code';
        return this.pupPage.evaluate(async (inviteInfo) => {
            let { groupId, fromId, inviteCode, inviteCodeExp } = inviteInfo;
            let userWid = window.require('WAWebWidFactory').createWid(fromId);
            return await window
                .require('WAWebGroupInviteV4Job')
                .joinGroupViaInviteV4(
                    inviteCode,
                    String(inviteCodeExp),
                    groupId,
                    userWid,
                );
        }, inviteInfo);
    }

    /**
     * Sets the current user's status message
     * @param {string} status New status message
     */
    async setStatus(status) {
        await this.pupPage.evaluate(async (status) => {
            return await window
                .require('WAWebContactStatusBridge')
                .setMyStatus(status);
        }, status);
    }

    /**
     * Sets the current user's display name.
     * This is the name shown to WhatsApp users that have not added you as a contact beside your number in groups and in your profile.
     * @param {string} displayName New display name
     * @returns {Promise<Boolean>}
     */
    async setDisplayName(displayName) {
        const couldSet = await this.pupPage.evaluate(async (displayName) => {
            if (!window.require('WAWebConnModel').Conn.canSetMyPushname())
                return false;
            await window
                .require('WAWebSetPushnameConnAction')
                .setPushname(displayName);
            return true;
        }, displayName);

        return couldSet;
    }

    /**
     * Gets the current connection state for the client
     * @returns {WAState}
     */
    async getState() {
        return await this.pupPage.evaluate(() => {
            return window.require('WAWebSocketModel').Socket.state ?? null;
        });
    }

    /**
     * Marks the client as online
     */
    async sendPresenceAvailable() {
        return await this.pupPage.evaluate(() => {
            return window
                .require('WAWebPresenceChatAction')
                .sendPresenceAvailable();
        });
    }

    /**
     * Marks the client as unavailable
     */
    async sendPresenceUnavailable() {
        return await this.pupPage.evaluate(() => {
            return window
                .require('WAWebPresenceChatAction')
                .sendPresenceUnavailable();
        });
    }

    /**
     * Enables and returns the archive state of the Chat
     * @returns {boolean}
     */
    async archiveChat(chatId) {
        return await this.pupPage.evaluate(async (chatId) => {
            let chat = await window.WWebJS.getChat(chatId, {
                getAsModel: false,
            });
            await window.require('WAWebCmd').Cmd.archiveChat(chat, true);
            return true;
        }, chatId);
    }

    /**
     * Changes and returns the archive state of the Chat
     * @returns {boolean}
     */
    async unarchiveChat(chatId) {
        return await this.pupPage.evaluate(async (chatId) => {
            let chat = await window.WWebJS.getChat(chatId, {
                getAsModel: false,
            });
            await window.require('WAWebCmd').Cmd.archiveChat(chat, false);
            return false;
        }, chatId);
    }

    /**
     * Pins the Chat
     * @returns {Promise<boolean>} New pin state. Could be false if the max number of pinned chats was reached.
     */
    async pinChat(chatId) {
        return this.pupPage.evaluate(async (chatId) => {
            let chat = await window.WWebJS.getChat(chatId, {
                getAsModel: false,
            });
            if (chat.pin) {
                return true;
            }
            const MAX_PIN_COUNT = 3;
            const chatModels = window
                .require('WAWebCollections')
                .Chat.getModelsArray();
            if (chatModels.length > MAX_PIN_COUNT) {
                let maxPinned = chatModels[MAX_PIN_COUNT - 1].pin;
                if (maxPinned) {
                    return false;
                }
            }
            await window.require('WAWebCmd').Cmd.pinChat(chat, true);
            return true;
        }, chatId);
    }

    /**
     * Unpins the Chat
     * @returns {Promise<boolean>} New pin state
     */
    async unpinChat(chatId) {
        return this.pupPage.evaluate(async (chatId) => {
            let chat = await window.WWebJS.getChat(chatId, {
                getAsModel: false,
            });
            if (!chat.pin) {
                return false;
            }
            await window.require('WAWebCmd').Cmd.pinChat(chat, false);
            return false;
        }, chatId);
    }

    /**
     * Mutes this chat forever, unless a date is specified
     * @param {string} chatId ID of the chat that will be muted
     * @param {?Date} unmuteDate Date when the chat will be unmuted, don't provide a value to mute forever
     * @returns {Promise<{isMuted: boolean, muteExpiration: number}>}
     */
    async muteChat(chatId, unmuteDate) {
        unmuteDate = unmuteDate ? Math.floor(unmuteDate.getTime() / 1000) : -1;
        return this._muteUnmuteChat(chatId, 'MUTE', unmuteDate);
    }

    /**
     * Unmutes the Chat
     * @param {string} chatId ID of the chat that will be unmuted
     * @returns {Promise<{isMuted: boolean, muteExpiration: number}>}
     */
    async unmuteChat(chatId) {
        return this._muteUnmuteChat(chatId, 'UNMUTE');
    }

    /**
     * Internal method to mute or unmute the chat
     * @param {string} chatId ID of the chat that will be muted/unmuted
     * @param {string} action The action: 'MUTE' or 'UNMUTE'
     * @param {number} unmuteDateTs Timestamp at which the chat will be unmuted
     * @returns {Promise<{isMuted: boolean, muteExpiration: number}>}
     */
    async _muteUnmuteChat(chatId, action, unmuteDateTs) {
        return this.pupPage.evaluate(
            async (chatId, action, unmuteDateTs) => {
                const chat =
                    window.require('WAWebCollections').Chat.get(chatId) ??
                    (await window
                        .require('WAWebCollections')
                        .Chat.find(chatId));
                action === 'MUTE'
                    ? await chat.mute.mute({
                          expiration: unmuteDateTs,
                          sendDevice: true,
                      })
                    : await chat.mute.unmute({ sendDevice: true });
                return {
                    isMuted: chat.mute.expiration !== 0,
                    muteExpiration: chat.mute.expiration,
                };
            },
            chatId,
            action,
            unmuteDateTs || -1,
        );
    }

    /**
     * Mark the Chat as unread
     * @param {string} chatId ID of the chat that will be marked as unread
     */
    async markChatUnread(chatId) {
        await this.pupPage.evaluate(async (chatId) => {
            let chat = await window.WWebJS.getChat(chatId, {
                getAsModel: false,
            });
            await window.require('WAWebCmd').Cmd.markChatUnread(chat, true);
        }, chatId);
    }

    /**
     * Returns the contact ID's profile picture URL, if privacy settings allow it
     * @param {string} contactId the whatsapp user's ID
     * @returns {Promise<string>}
     */
    async getProfilePicUrl(contactId) {
        const profilePic = await this.pupPage.evaluate(async (contactId) => {
            try {
                const chat = await window.WWebJS.getChat(contactId);
                return await window
                    .require('WAWebContactProfilePicThumbBridge')
                    .requestProfilePicFromServer(chat);
            } catch (err) {
                if (err.name === 'ServerStatusCodeError') return undefined;
                throw err;
            }
        }, contactId);

        return profilePic ? profilePic.eurl : undefined;
    }

    /**
     * Gets the Contact's common groups with you. Returns empty array if you don't have any common group.
     * @param {string} contactId the whatsapp user's ID (_serialized format)
     * @returns {Promise<WAWebJS.ChatId[]>}
     */
    async getCommonGroups(contactId) {
        const commonGroups = await this.pupPage.evaluate(async (contactId) => {
            let contact = window
                .require('WAWebCollections')
                .Contact.get(contactId);
            if (!contact) {
                const wid = window
                    .require('WAWebWidFactory')
                    .createWid(contactId);
                const chatConstructor = window
                    .require('WAWebCollections')
                    .Contact.getModelsArray()
                    .find((c) => !c.isGroup).constructor;
                contact = new chatConstructor({ id: wid });
            }

            if (contact.commonGroups) {
                return contact.commonGroups.serialize();
            }
            const status = await window
                .require('WAWebFindCommonGroupsContactAction')
                .findCommonGroups(contact);
            if (status) {
                return contact.commonGroups.serialize();
            }
            return [];
        }, contactId);
        const chats = [];
        for (const group of commonGroups) {
            chats.push(group.id);
        }
        return chats;
    }

    /**
     * Force reset of connection state for the client
     */
    async resetState() {
        await this.pupPage.evaluate(() => {
            window.require('WAWebSocketModel').Socket.reconnect();
        });
    }

    /**
     * Check if a given ID is registered in whatsapp
     * @param {string} id the whatsapp user's ID
     * @returns {Promise<Boolean>}
     */
    async isRegisteredUser(id) {
        return Boolean(await this.getNumberId(id));
    }

    /**
     * Get the registered WhatsApp ID for a number.
     * Will return null if the number is not registered on WhatsApp.
     * @param {string} number Number or ID ("@c.us" will be automatically appended if not specified)
     * @returns {Promise<Object|null>}
     */
    async getNumberId(number) {
        if (!number.endsWith('@c.us')) {
            number += '@c.us';
        }

        return await this.pupPage.evaluate(async (number) => {
            const wid = window.require('WAWebWidFactory').createWid(number);
            const result = await window
                .require('WAWebQueryExistsJob')
                .queryWidExists(wid);
            if (!result || result.wid === undefined) return null;
            return result.wid;
        }, number);
    }

    /**
     * Get the formatted number of a WhatsApp ID.
     * @param {string} number Number or ID
     * @returns {Promise<string>}
     */
    async getFormattedNumber(number) {
        if (!number.endsWith('@s.whatsapp.net'))
            number = number.replace('c.us', 's.whatsapp.net');
        if (!number.includes('@s.whatsapp.net'))
            number = `${number}@s.whatsapp.net`;

        return await this.pupPage.evaluate(async (numberId) => {
            return window
                .require('WAWebPhoneUtils')
                .formattedPhoneNumber(numberId);
        }, number);
    }

    /**
     * Get the country code of a WhatsApp ID.
     * @param {string} number Number or ID
     * @returns {Promise<string>}
     */
    async getCountryCode(number) {
        number = number.replace(' ', '').replace('+', '').replace('@c.us', '');

        return await this.pupPage.evaluate(async (numberId) => {
            return window.require('WAPhoneFindCC').findCC(numberId);
        }, number);
    }

    /**
     * An object that represents the result for a participant added to a group
     * @typedef {Object} ParticipantResult
     * @property {number} statusCode The status code of the result
     * @property {string} message The result message
     * @property {boolean} isGroupCreator Indicates if the participant is a group creator
     * @property {boolean} isInviteV4Sent Indicates if the inviteV4 was sent to the participant
     */

    /**
     * An object that handles the result for {@link createGroup} method
     * @typedef {Object} CreateGroupResult
     * @property {string} title A group title
     * @property {Object} gid An object that handles the newly created group ID
     * @property {string} gid.server
     * @property {string} gid.user
     * @property {string} gid._serialized
     * @property {Object.<string, ParticipantResult>} participants An object that handles the result value for each added to the group participant
     */

    /**
     * An object that handles options for group creation
     * @typedef {Object} CreateGroupOptions
     * @property {number} [messageTimer = 0] The number of seconds for the messages to disappear in the group (0 by default, won't take an effect if the group is been creating with myself only)
     * @property {string|undefined} parentGroupId The ID of a parent community group to link the newly created group with (won't take an effect if the group is been creating with myself only)
     * @property {boolean} [autoSendInviteV4 = true] If true, the inviteV4 will be sent to those participants who have restricted others from being automatically added to groups, otherwise the inviteV4 won't be sent (true by default)
     * @property {string} [comment = ''] The comment to be added to an inviteV4 (empty string by default)
     * @property {boolean} [memberAddMode = false] If true, only admins can add members to the group (false by default)
     * @property {boolean} [membershipApprovalMode = false] If true, group admins will be required to approve anyone who wishes to join the group (false by default)
     * @property {boolean} [isRestrict = true] If true, only admins can change group group info (true by default)
     * @property {boolean} [isAnnounce = false] If true, only admins can send messages (false by default)
     */

    /**
     * Creates a new group
     * @param {string} title Group title
     * @param {string|Contact|Array<Contact|string>|undefined} participants A single Contact object or an ID as a string or an array of Contact objects or contact IDs to add to the group
     * @param {CreateGroupOptions} options An object that handles options for group creation
     * @returns {Promise<CreateGroupResult|string>} Object with resulting data or an error message as a string
     */
    async createGroup(title, participants = [], options = {}) {
        !Array.isArray(participants) && (participants = [participants]);
        participants.map((p) => (p instanceof Contact ? p.id._serialized : p));

        return await this.pupPage.evaluate(
            async (title, participants, options) => {
                const {
                    messageTimer = 0,
                    parentGroupId,
                    autoSendInviteV4 = true,
                    comment = '',
                } = options;
                const participantData = {},
                    participantWids = [],
                    failedParticipants = [];
                let createGroupResult, parentGroupWid;

                const addParticipantResultCodes = {
                    default:
                        'An unknown error occupied while adding a participant',
                    200: 'The participant was added successfully',
                    403: 'The participant can be added by sending private invitation only',
                    404: 'The phone number is not registered on WhatsApp',
                };

                for (const participant of participants) {
                    const pWid = window
                        .require('WAWebWidFactory')
                        .createWid(participant);
                    if (
                        (
                            await window
                                .require('WAWebQueryExistsJob')
                                .queryWidExists(pWid)
                        )?.wid
                    ) {
                        participantWids.push({ phoneNumber: pWid });
                    } else failedParticipants.push(participant);
                }

                parentGroupId &&
                    (parentGroupWid = window
                        .require('WAWebWidFactory')
                        .createWid(parentGroupId));

                try {
                    createGroupResult = await window
                        .require('WAWebGroupCreateJob')
                        .createGroup(
                            {
                                addressingModeOverride: 'lid',
                                memberAddMode: options.memberAddMode ?? false,
                                membershipApprovalMode:
                                    options.membershipApprovalMode ?? false,
                                announce: options.announce ?? false,
                                restrict:
                                    options.isRestrict !== undefined
                                        ? !options.isRestrict
                                        : false,
                                ephemeralDuration: messageTimer,
                                parentGroupId: parentGroupWid,
                                title: title,
                            },
                            participantWids,
                        );
                } catch (err) {
                    return 'CreateGroupError: An unknown error occupied while creating a group';
                }

                for (const participant of createGroupResult.participants) {
                    let isInviteV4Sent = false;
                    participant.wid.server == 'lid' &&
                        (participant.wid = window
                            .require('WAWebApiContact')
                            .getPhoneNumber(participant.wid));
                    const participantId = participant.wid._serialized;
                    const statusCode = participant.error || 200;

                    if (autoSendInviteV4 && statusCode === 403) {
                        window
                            .require('WAWebCollections')
                            .Contact.gadd(participant.wid, { silent: true });
                        const addParticipantResult = await window
                            .require('WAWebChatSendMessages')
                            .sendGroupInviteMessage(
                                window
                                    .require('WAWebCollections')
                                    .Chat.get(participant.wid) ||
                                    (await window
                                        .require('WAWebCollections')
                                        .Chat.find(participant.wid)),
                                createGroupResult.wid._serialized,
                                createGroupResult.subject,
                                participant.invite_code,
                                participant.invite_code_exp,
                                comment,
                                await window.WWebJS.getProfilePicThumbToBase64(
                                    createGroupResult.wid,
                                ),
                            );
                        isInviteV4Sent =
                            addParticipantResult.messageSendResult === 'OK';
                    }

                    participantData[participantId] = {
                        statusCode: statusCode,
                        message:
                            addParticipantResultCodes[statusCode] ||
                            addParticipantResultCodes.default,
                        isGroupCreator: participant.type === 'superadmin',
                        isInviteV4Sent: isInviteV4Sent,
                    };
                }

                for (const f of failedParticipants) {
                    participantData[f] = {
                        statusCode: 404,
                        message: addParticipantResultCodes[404],
                        isGroupCreator: false,
                        isInviteV4Sent: false,
                    };
                }

                return {
                    title: title,
                    gid: createGroupResult.wid,
                    participants: participantData,
                };
            },
            title,
            participants,
            options,
        );
    }

    /**
     * An object that handles the result for {@link createChannel} method
     * @typedef {Object} CreateChannelResult
     * @property {string} title A channel title
     * @property {ChatId} nid An object that handels the newly created channel ID
     * @property {string} nid.server 'newsletter'
     * @property {string} nid.user 'XXXXXXXXXX'
     * @property {string} nid._serialized 'XXXXXXXXXX@newsletter'
     * @property {string} inviteLink The channel invite link, starts with 'https://whatsapp.com/channel/'
     * @property {number} createdAtTs The timestamp the channel was created at
     */

    /**
     * Options for the channel creation
     * @typedef {Object} CreateChannelOptions
     * @property {?string} description The channel description
     * @property {?MessageMedia} picture The channel profile picture
     */

    /**
     * Creates a new channel
     * @param {string} title The channel name
     * @param {CreateChannelOptions} options
     * @returns {Promise<CreateChannelResult|string>} Returns an object that handles the result for the channel creation or an error message as a string
     */
    async createChannel(title, options = {}) {
        return await this.pupPage.evaluate(
            async (title, options) => {
                let response,
                    { description = null, picture = null } = options;

                if (
                    !window
                        .require('WAWebNewsletterGatingUtils')
                        .isNewsletterCreationEnabled()
                ) {
                    return 'CreateChannelError: A channel creation is not enabled';
                }

                if (picture) {
                    picture = await window.WWebJS.cropAndResizeImage(picture, {
                        asDataUrl: true,
                        mimetype: 'image/jpeg',
                        size: 640,
                        quality: 1,
                    });
                }

                try {
                    response = await window
                        .require('WAWebNewsletterCreateQueryJob')
                        .createNewsletterQuery({
                            name: title,
                            description: description,
                            picture: picture,
                        });
                } catch (err) {
                    if (err.name === 'ServerStatusCodeError') {
                        return 'CreateChannelError: An error occupied while creating a channel';
                    }
                    throw err;
                }

                return {
                    title: title,
                    nid: window
                        .require('WAWebJidToWid')
                        .newsletterJidToWid(response.idJid),
                    inviteLink: `https://whatsapp.com/channel/${response.newsletterInviteLinkMetadataMixin.inviteCode}`,
                    createdAtTs:
                        response.newsletterCreationTimeMetadataMixin
                            .creationTimeValue,
                };
            },
            title,
            options,
        );
    }

    /**
     * Subscribe to channel
     * @param {string} channelId The channel ID
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async subscribeToChannel(channelId) {
        return await this.pupPage.evaluate(async (channelId) => {
            return await window.WWebJS.subscribeToUnsubscribeFromChannel(
                channelId,
                'Subscribe',
            );
        }, channelId);
    }

    /**
     * Options for unsubscribe from a channel
     * @typedef {Object} UnsubscribeOptions
     * @property {boolean} [deleteLocalModels = false] If true, after an unsubscription, it will completely remove a channel from the channel collection making it seem like the current user have never interacted with it. Otherwise it will only remove a channel from the list of channels the current user is subscribed to and will set the membership type for that channel to GUEST
     */

    /**
     * Unsubscribe from channel
     * @param {string} channelId The channel ID
     * @param {UnsubscribeOptions} options
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async unsubscribeFromChannel(channelId, options) {
        return await this.pupPage.evaluate(
            async (channelId, options) => {
                return await window.WWebJS.subscribeToUnsubscribeFromChannel(
                    channelId,
                    'Unsubscribe',
                    options,
                );
            },
            channelId,
            options,
        );
    }

    /**
     * Options for transferring a channel ownership to another user
     * @typedef {Object} TransferChannelOwnershipOptions
     * @property {boolean} [shouldDismissSelfAsAdmin = false] If true, after the channel ownership is being transferred to another user, the current user will be dismissed as a channel admin and will become to a channel subscriber.
     */

    /**
     * Transfers a channel ownership to another user.
     * Note: the user you are transferring the channel ownership to must be a channel admin.
     * @param {string} channelId
     * @param {string} newOwnerId
     * @param {TransferChannelOwnershipOptions} options
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async transferChannelOwnership(channelId, newOwnerId, options = {}) {
        return await this.pupPage.evaluate(
            async (channelId, newOwnerId, options) => {
                const channel = await window.WWebJS.getChat(channelId, {
                    getAsModel: false,
                });
                const newOwner =
                    window
                        .require('WAWebCollections')
                        .Contact.get(newOwnerId) ||
                    (await window
                        .require('WAWebCollections')
                        .Contact.find(newOwnerId));
                if (!channel.newsletterMetadata) {
                    await window
                        .require('WAWebCollections')
                        .NewsletterMetadataCollection.update(channel.id);
                }

                try {
                    await window
                        .require('WAWebChangeNewsletterOwnerAction')
                        .changeNewsletterOwnerAction(channel, newOwner);

                    if (options.shouldDismissSelfAsAdmin) {
                        const meContact = window
                            .require('WAWebContactCollection')
                            .getMeContact();
                        meContact &&
                            (await window
                                .require('WAWebNewsletterDemoteAdminJob')
                                .demoteNewsletterAdminAction(
                                    channel,
                                    meContact,
                                ));
                    }
                } catch (error) {
                    return false;
                }

                return true;
            },
            channelId,
            newOwnerId,
            options,
        );
    }

    /**
     * Searches for channels based on search criteria, there are some notes:
     * 1. The method finds only channels you are not subscribed to currently
     * 2. If you have never been subscribed to a found channel
     * or you have unsubscribed from it with {@link UnsubscribeOptions.deleteLocalModels} set to 'true',
     * the lastMessage property of a found channel will be 'null'
     *
     * @param {Object} searchOptions Search options
     * @param {string} [searchOptions.searchText = ''] Text to search
     * @param {Array<string>} [searchOptions.countryCodes = [your local region]] Array of country codes in 'ISO 3166-1 alpha-2' standart (@see https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) to search for channels created in these countries
     * @param {boolean} [searchOptions.skipSubscribedNewsletters = false] If true, channels that user is subscribed to won't appear in found channels
     * @param {number} [searchOptions.view = 0] View type, makes sense only when the searchText is empty. Valid values to provide are:
     * 0 for RECOMMENDED channels
     * 1 for TRENDING channels
     * 2 for POPULAR channels
     * 3 for NEW channels
     * @param {number} [searchOptions.limit = 50] The limit of found channels to be appear in the returnig result
     * @returns {Promise<Array<Channel>>} Returns an array of Channel objects or an empty array if no channels were found
     */
    async searchChannels(searchOptions = {}) {
        return await this.pupPage.evaluate(
            async ({
                searchText = '',
                countryCodes = [],
                skipSubscribedNewsletters = false,
                view = 0,
                limit = 50,
            }) => {
                searchText = searchText.trim();
                const currentRegion = window.require('WAWebL10N').getRegion();
                if (countryCodes.length === 0) countryCodes[0] = currentRegion;
                if (![0, 1, 2, 3].includes(view)) view = 0;

                const { countryCodesIso } = window.require(
                    'WAWebCountriesNativeCountryNames',
                );

                countryCodes =
                    countryCodes.length === 1 &&
                    countryCodes[0] === currentRegion
                        ? countryCodes
                        : countryCodes.filter((code) =>
                              Object.keys(countryCodesIso).includes(code),
                          );

                const viewTypeMapping = {
                    0: 'RECOMMENDED',
                    1: 'TRENDING',
                    2: 'POPULAR',
                    3: 'NEW',
                };

                searchOptions = {
                    searchText: searchText,
                    countryCodes: countryCodes,
                    skipSubscribedNewsletters: skipSubscribedNewsletters,
                    view: viewTypeMapping[view],
                    categories: [],
                    cursorToken: '',
                };

                const originalFunction = window.require(
                    'WAWebNewsletterGatingUtils',
                ).getNewsletterDirectoryPageSize;
                limit !== 50 &&
                    (window.require(
                        'WAWebNewsletterGatingUtils',
                    ).getNewsletterDirectoryPageSize = () => limit);

                const channels = (
                    await window
                        .require('WAWebNewsletterDirectorySearchAction')
                        .fetchNewsletterDirectories(searchOptions)
                ).newsletters;

                limit !== 50 &&
                    (window.require(
                        'WAWebNewsletterGatingUtils',
                    ).getNewsletterDirectoryPageSize = originalFunction);

                return channels
                    ? await Promise.all(
                          channels.map((channel) =>
                              window.WWebJS.getChatModel(channel, {
                                  isChannel: true,
                              }),
                          ),
                      )
                    : [];
            },
            searchOptions,
        );
    }

    /**
     * Deletes the channel you created
     * @param {string} channelId The ID of a channel to delete
     * @returns {Promise<boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async deleteChannel(channelId) {
        return await this.pupPage.evaluate(async (channelId) => {
            const channel = await window.WWebJS.getChat(channelId, {
                getAsModel: false,
            });
            if (!channel) return false;
            try {
                await window
                    .require('WAWebNewsletterDeleteAction')
                    .deleteNewsletterAction(channel);
                return true;
            } catch (err) {
                if (err.name === 'ServerStatusCodeError') return false;
                throw err;
            }
        }, channelId);
    }

    /**
     * Get all current Labels
     * @returns {Promise<Array<Label>>}
     */
    async getLabels() {
        const labels = await this.pupPage.evaluate(async () => {
            return window.WWebJS.getLabels();
        });

        return labels.map((data) => new Label(this, data));
    }

    /**
     * Get all current Broadcast
     * @returns {Promise<Array<Broadcast>>}
     */
    async getBroadcasts() {
        const broadcasts = await this.pupPage.evaluate(async () => {
            return window.WWebJS.getAllStatuses();
        });
        return broadcasts.map((data) => new Broadcast(this, data));
    }

    /**
     * Get broadcast instance by current user ID
     * @param {string} contactId
     * @returns {Promise<Broadcast>}
     */
    async getBroadcastById(contactId) {
        const broadcast = await this.pupPage.evaluate(async (userId) => {
            let status;
            try {
                status = window.require('WAWebCollections').Status.get(userId);
                if (!status) {
                    status = await window
                        .require('WAWebCollections')
                        .Status.find(userId);
                }
            } catch {
                status = null;
            }

            if (status) return window.WWebJS.getStatusModel(status);
        }, contactId);
        return new Broadcast(this, broadcast);
    }

    /**
     * Revoke current own status messages
     * @param {string} messageId
     * @returns {Promise<void>}
     */
    async revokeStatusMessage(messageId) {
        return await this.pupPage.evaluate(async (msgId) => {
            const status = window
                .require('WAWebCollections')
                .Status.getMyStatus();
            if (!status) return;

            const msg =
                window.require('WAWebCollections').Msg.get(msgId) ||
                (
                    await window
                        .require('WAWebCollections')
                        .Msg.getMessagesById([msgId])
                )?.messages?.[0];
            if (!msg) return;

            if (!msg.id.fromMe || !msg.id.remote.isStatus())
                throw 'Invalid usage! Can only revoke the message its from own status broadcast';

            return await window
                .require('WAWebRevokeStatusAction')
                .sendStatusRevokeMsgAction(status, msg);
        }, messageId);
    }

    /**
     * Get Label instance by ID
     * @param {string} labelId
     * @returns {Promise<Label>}
     */
    async getLabelById(labelId) {
        const label = await this.pupPage.evaluate(async (labelId) => {
            return window.WWebJS.getLabel(labelId);
        }, labelId);

        return new Label(this, label);
    }

    /**
     * Get all Labels assigned to a chat
     * @param {string} chatId
     * @returns {Promise<Array<Label>>}
     */
    async getChatLabels(chatId) {
        const labels = await this.pupPage.evaluate(async (chatId) => {
            return window.WWebJS.getChatLabels(chatId);
        }, chatId);

        return labels.map((data) => new Label(this, data));
    }

    /**
     * Get all Chats for a specific Label
     * @param {string} labelId
     * @returns {Promise<Array<Chat>>}
     */
    async getChatsByLabelId(labelId) {
        const chatIds = await this.pupPage.evaluate(async (labelId) => {
            const label = window.require('WAWebCollections').Label.get(labelId);
            const labelItems = label.labelItemCollection.getModelsArray();
            return labelItems.reduce((result, item) => {
                if (item.parentType === 'Chat') {
                    result.push(item.parentId);
                }
                return result;
            }, []);
        }, labelId);

        return Promise.all(chatIds.map((id) => this.getChatById(id)));
    }

    /**
     * Gets all blocked contacts by host account
     * @returns {Promise<Array<Contact>>}
     */
    async getBlockedContacts() {
        const blockedContacts = await this.pupPage.evaluate(() => {
            let chatIds = window
                .require('WAWebCollections')
                .Blocklist.getModelsArray()
                .map((a) => a.id._serialized);
            return Promise.all(
                chatIds.map((id) => window.WWebJS.getContact(id)),
            );
        });

        return blockedContacts.map((contact) =>
            ContactFactory.create(this.client, contact),
        );
    }

    /**
     * Sets the current user's profile picture.
     * @param {MessageMedia} media
     * @returns {Promise<boolean>} Returns true if the picture was properly updated.
     */
    async setProfilePicture(media) {
        const success = await this.pupPage.evaluate(
            (chatid, media) => {
                return window.WWebJS.setPicture(chatid, media);
            },
            this.info.wid._serialized,
            media,
        );

        return success;
    }

    /**
     * Deletes the current user's profile picture.
     * @returns {Promise<boolean>} Returns true if the picture was properly deleted.
     */
    async deleteProfilePicture() {
        const success = await this.pupPage.evaluate((chatid) => {
            return window.WWebJS.deletePicture(chatid);
        }, this.info.wid._serialized);

        return success;
    }

    /**
     * Change labels in chats
     * @param {Array<number|string>} labelIds
     * @param {Array<string>} chatIds
     * @returns {Promise<void>}
     */
    async addOrRemoveLabels(labelIds, chatIds) {
        return this.pupPage.evaluate(
            async (labelIds, chatIds) => {
                if (
                    ['smba', 'smbi'].indexOf(
                        window.require('WAWebConnModel').Conn.platform,
                    ) === -1
                ) {
                    throw '[LT01] Only Whatsapp business';
                }
                const labels = window.WWebJS.getLabels().filter(
                    (e) => labelIds.find((l) => l == e.id) !== undefined,
                );
                const chats = window
                    .require('WAWebCollections')
                    .Chat.filter((e) => chatIds.includes(e.id._serialized));

                let actions = labels.map((label) => ({
                    id: label.id,
                    type: 'add',
                }));

                chats.forEach((chat) => {
                    (chat.labels || []).forEach((n) => {
                        if (!actions.find((e) => e.id == n)) {
                            actions.push({ id: n, type: 'remove' });
                        }
                    });
                });

                return await window
                    .require('WAWebCollections')
                    .Label.addOrRemoveLabels(actions, chats);
            },
            labelIds,
            chatIds,
        );
    }

    /**
     * An object that handles the information about the group membership request
     * @typedef {Object} GroupMembershipRequest
     * @property {Object} id The wid of a user who requests to enter the group
     * @property {Object} addedBy The wid of a user who created that request
     * @property {Object|null} parentGroupId The wid of a community parent group to which the current group is linked
     * @property {string} requestMethod The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin
     * @property {number} t The timestamp the request was created at
     */

    /**
     * Gets an array of membership requests
     * @param {string} groupId The ID of a group to get membership requests for
     * @returns {Promise<Array<GroupMembershipRequest>>} An array of membership requests
     */
    async getGroupMembershipRequests(groupId) {
        return await this.pupPage.evaluate(async (groupId) => {
            const groupWid = window
                .require('WAWebWidFactory')
                .createWid(groupId);
            return await window
                .require('WAWebApiMembershipApprovalRequestStore')
                .getMembershipApprovalRequests(groupWid);
        }, groupId);
    }

    /**
     * An object that handles the result for membership request action
     * @typedef {Object} MembershipRequestActionResult
     * @property {string} requesterId User ID whos membership request was approved/rejected
     * @property {number|undefined} error An error code that occurred during the operation for the participant
     * @property {string} message A message with a result of membership request action
     */

    /**
     * An object that handles options for {@link approveGroupMembershipRequests} and {@link rejectGroupMembershipRequests} methods
     * @typedef {Object} MembershipRequestActionOptions
     * @property {Array<string>|string|null} requesterIds User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group
     * @property {Array<number>|number|null} sleep The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500]
     */

    /**
     * Approves membership requests if any
     * @param {string} groupId The group ID to get the membership request for
     * @param {MembershipRequestActionOptions} options Options for performing a membership request action
     * @returns {Promise<Array<MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were approved and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
     */
    async approveGroupMembershipRequests(groupId, options = {}) {
        return await this.pupPage.evaluate(
            async (groupId, options) => {
                const { requesterIds = null, sleep = [250, 500] } = options;
                return await window.WWebJS.membershipRequestAction(
                    groupId,
                    'Approve',
                    requesterIds,
                    sleep,
                );
            },
            groupId,
            options,
        );
    }

    /**
     * Rejects membership requests if any
     * @param {string} groupId The group ID to get the membership request for
     * @param {MembershipRequestActionOptions} options Options for performing a membership request action
     * @returns {Promise<Array<MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were rejected and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
     */
    async rejectGroupMembershipRequests(groupId, options = {}) {
        return await this.pupPage.evaluate(
            async (groupId, options) => {
                const { requesterIds = null, sleep = [250, 500] } = options;
                return await window.WWebJS.membershipRequestAction(
                    groupId,
                    'Reject',
                    requesterIds,
                    sleep,
                );
            },
            groupId,
            options,
        );
    }

    /**
     * Setting  autoload download audio
     * @param {boolean} flag true/false
     */
    async setAutoDownloadAudio(flag) {
        await this.pupPage.evaluate(async (flag) => {
            const autoDownload = window
                .require('WAWebUserPrefsGeneral')
                .getAutoDownloadAudio();
            if (autoDownload === flag) {
                return flag;
            }
            await window
                .require('WAWebUserPrefsGeneral')
                .setAutoDownloadAudio(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download documents
     * @param {boolean} flag true/false
     */
    async setAutoDownloadDocuments(flag) {
        await this.pupPage.evaluate(async (flag) => {
            const autoDownload = window
                .require('WAWebUserPrefsGeneral')
                .getAutoDownloadDocuments();
            if (autoDownload === flag) {
                return flag;
            }
            await window
                .require('WAWebUserPrefsGeneral')
                .setAutoDownloadDocuments(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download photos
     * @param {boolean} flag true/false
     */
    async setAutoDownloadPhotos(flag) {
        await this.pupPage.evaluate(async (flag) => {
            const autoDownload = window
                .require('WAWebUserPrefsGeneral')
                .getAutoDownloadPhotos();
            if (autoDownload === flag) {
                return flag;
            }
            await window
                .require('WAWebUserPrefsGeneral')
                .setAutoDownloadPhotos(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download videos
     * @param {boolean} flag true/false
     */
    async setAutoDownloadVideos(flag) {
        await this.pupPage.evaluate(async (flag) => {
            const autoDownload = window
                .require('WAWebUserPrefsGeneral')
                .getAutoDownloadVideos();
            if (autoDownload === flag) {
                return flag;
            }
            await window
                .require('WAWebUserPrefsGeneral')
                .setAutoDownloadVideos(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting background synchronization.
     * NOTE: this action will take effect after you restart the client.
     * @param {boolean} flag true/false
     * @returns {Promise<boolean>}
     */
    async setBackgroundSync(flag) {
        return await this.pupPage.evaluate(async (flag) => {
            const backSync = window
                .require('WAWebUserPrefsNotifications')
                .getGlobalOfflineNotifications();
            if (backSync === flag) {
                return flag;
            }
            await window
                .require('WAWebUserPrefsNotifications')
                .setGlobalOfflineNotifications(flag);
            return flag;
        }, flag);
    }

    /**
     * Get user device count by ID
     * Each WaWeb Connection counts as one device, and the phone (if exists) counts as one
     * So for a non-enterprise user with one WaWeb connection it should return "2"
     * @param {string} userId
     * @returns {Promise<number>}
     */
    async getContactDeviceCount(userId) {
        return await this.pupPage.evaluate(async (userId) => {
            const devices = await window
                .require('WAWebApiDeviceList')
                .getDeviceIds([
                    window.require('WAWebWidFactory').createWid(userId),
                ]);
            if (
                devices &&
                devices.length &&
                devices[0] != null &&
                typeof devices[0].devices == 'object'
            ) {
                return devices[0].devices.length;
            }
            return 0;
        }, userId);
    }

    /**
     * Sync chat history conversation
     * @param {string} chatId
     * @return {Promise<boolean>} True if operation completed successfully, false otherwise.
     */
    async syncHistory(chatId) {
        return await this.pupPage.evaluate(async (chatId) => {
            const chatWid = window.require('WAWebWidFactory').createWid(chatId);
            const chat =
                window.require('WAWebCollections').Chat.get(chatWid) ??
                (await window.require('WAWebCollections').Chat.find(chatWid));
            if (chat?.endOfHistoryTransferType === 0) {
                await window
                    .require('WAWebSendNonMessageDataRequest')
                    .sendPeerDataOperationRequest(3, {
                        chatId: chat.id,
                    });
                return true;
            }
            return false;
        }, chatId);
    }

    /**
     * Generates a WhatsApp call link (video call or voice call)
     * @param {Date} startTime The start time of the call
     * @param {string} callType The type of a WhatsApp call link to generate, valid values are: `video` | `voice`
     * @returns {Promise<string>} The WhatsApp call link (https://call.whatsapp.com/video/XxXxXxXxXxXxXx) or an empty string if a generation failed.
     */
    async createCallLink(startTime, callType) {
        if (!['video', 'voice'].includes(callType)) {
            throw new (class CreateCallLinkError extends Error {
                constructor(m) {
                    super(m);
                }
            })(
                "Invalid 'callType' parameter value is provided. Valid values are: 'voice' | 'video'.",
            );
        }

        startTime = Math.floor(startTime.getTime() / 1000);

        return await this.pupPage.evaluate(
            async (startTimeTs, callType) => {
                const response = await window
                    .require('WAWebGenerateEventCallLink')
                    .createEventCallLink(startTimeTs, callType);
                return response ?? '';
            },
            startTime,
            callType,
        );
    }

    /**
     * Sends a response to the scheduled event message, indicating whether a user is going to attend the event or not
     * @param {number} response The response code to the scheduled event message. Valid values are: `0` for NONE response (removes a previous response) | `1` for GOING | `2` for NOT GOING | `3` for MAYBE going
     * @param {string} eventMessageId The scheduled event message ID
     * @returns {Promise<boolean>}
     */
    async sendResponseToScheduledEvent(response, eventMessageId) {
        if (![0, 1, 2, 3].includes(response)) return false;

        return await this.pupPage.evaluate(
            async (response, msgId) => {
                const eventMsg =
                    window.require('WAWebCollections').Msg.get(msgId) ||
                    (
                        await window
                            .require('WAWebCollections')
                            .Msg.getMessagesById([msgId])
                    )?.messages?.[0];
                if (!eventMsg) return false;

                await window
                    .require('WAWebSendEventResponseMsgAction')
                    .sendEventResponseMsg(response, eventMsg);
                return true;
            },
            response,
            eventMessageId,
        );
    }

    /**
     * Save new contact to user's addressbook or edit the existing one
     * @param {string} phoneNumber The contact's phone number in a format "17182222222", where "1" is a country code
     * @param {string} firstName
     * @param {string} lastName
     * @param {boolean} [syncToAddressbook = false] If set to true, the contact will also be saved to the user's address book on their phone. False by default
     * @returns {Promise<void>}
     */
    async saveOrEditAddressbookContact(
        phoneNumber,
        firstName,
        lastName,
        syncToAddressbook = false,
    ) {
        return await this.pupPage.evaluate(
            async (phoneNumber, firstName, lastName, syncToAddressbook) => {
                return await window
                    .require('WAWebSaveContactAction')
                    .saveContactAction({
                        firstName: firstName,
                        lastName: lastName,
                        phoneNumber: phoneNumber,
                        prevPhoneNumber: phoneNumber,
                        syncToAddressbook: syncToAddressbook,
                        username: undefined,
                    });
            },
            phoneNumber,
            firstName,
            lastName,
            syncToAddressbook,
        );
    }

    /**
     * Deletes the contact from user's addressbook
     * @param {string} phoneNumber The contact's phone number in a format "17182222222", where "1" is a country code
     * @returns {Promise<void>}
     */
    async deleteAddressbookContact(phoneNumber) {
        return await this.pupPage.evaluate(async (phoneNumber) => {
            const wid = window
                .require('WAWebWidFactory')
                .createWid(phoneNumber);
            return await window
                .require('WAWebDeleteContactAction')
                .deleteContactAction({ phoneNumber: wid });
        }, phoneNumber);
    }

    /**
     * Get lid and phone number for multiple users
     * @param {string[]} userIds - Array of user IDs
     * @returns {Promise<Array<{ lid: string, pn: string }>>}
     */
    async getContactLidAndPhone(userIds) {
        return await this.pupPage.evaluate(async (userIds) => {
            if (!Array.isArray(userIds)) userIds = [userIds];

            return await Promise.all(
                userIds.map(async (userId) => {
                    const { lid, phone } =
                        await window.WWebJS.enforceLidAndPnRetrieval(userId);

                    return {
                        lid: lid?._serialized,
                        pn: phone?._serialized,
                    };
                }),
            );
        }, userIds);
    }

    /**
     * Add or edit a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} userId The ID of a customer to add a note to
     * @param {string} note The note to add
     * @returns {Promise<void>}
     */
    async addOrEditCustomerNote(userId, note) {
        return await this.pupPage.evaluate(
            async (userId, note) => {
                if (!window.require('WAWebBizGatingUtils').smbNotesV1Enabled())
                    return;

                return window
                    .require('WAWebNoteAction')
                    .noteAddAction(
                        'unstructured',
                        window
                            .require('WAWebWidToJid')
                            .widToUserJid(
                                window
                                    .require('WAWebWidFactory')
                                    .createWid(userId),
                            ),
                        note,
                    );
            },
            userId,
            note,
        );
    }

    /**
     * Get a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} userId The ID of a customer to get a note from
     * @returns {Promise<{
     *    chatId: string,
     *    content: string,
     *    createdAt: number,
     *    id: string,
     *    modifiedAt: number,
     *    type: string
     * }>}
     */
    async getCustomerNote(userId) {
        return await this.pupPage.evaluate(async (userId) => {
            if (!window.require('WAWebBizGatingUtils').smbNotesV1Enabled())
                return null;

            const note = await window
                .require('WAWebNoteAction')
                .retrieveOnlyNoteForChatJid(
                    window
                        .require('WAWebWidToJid')
                        .widToUserJid(
                            window.require('WAWebWidFactory').createWid(userId),
                        ),
                );

            let serialized = note?.serialize();

            if (!serialized) return null;

            serialized.chatId = window
                .require('WAWebJidToWid')
                .userJidToUserWid(serialized.chatJid)._serialized;
            delete serialized.chatJid;

            return serialized;
        }, userId);
    }

    /**
     * Get Poll Votes
     * @param {string} messageId
     * @return {Promise<Array<PollVote>>}
     */
    async getPollVotes(messageId) {
        const msg = await this.getMessageById(messageId);
        if (!msg) return [];
        if (msg.type != MessageTypes.POLL_CREATION)
            throw 'Invalid usage! Can only be used with a pollCreation message';

        const pollVotes = await this.pupPage.evaluate(async (msg) => {
            const msgKey = window
                .require('WAWebMsgKey')
                .fromString(msg.id._serialized);
            let pollVotes = await window
                .require('WAWebPollsVotesSchema')
                .getTable()
                .equals(['parentMsgKey'], msgKey.toString());

            return pollVotes.map((item) => {
                const typedArray = new Uint8Array(item.selectedOptionLocalIds);
                return {
                    ...item,
                    selectedOptionLocalIds: Array.from(typedArray),
                };
            });
        }, msg);

        return pollVotes.map(
            (pollVote) =>
                new PollVote(this.client, { ...pollVote, parentMessage: msg }),
        );
    }
}

module.exports = Client;
