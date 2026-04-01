import { EventEmitter } from 'events';
import { RequestInit } from 'node-fetch';
import * as puppeteer from 'puppeteer';
import InterfaceController from './src/util/InterfaceController';

declare namespace WAWebJS {
    export class Client extends EventEmitter {
        constructor(options: ClientOptions);

        /** Current connection information */
        public info: ClientInfo;

        /** Puppeteer page running WhatsApp Web */
        pupPage?: puppeteer.Page;

        /** Puppeteer browser running WhatsApp Web */
        pupBrowser?: puppeteer.Browser;

        /** Client interactivity interface */
        interface?: InterfaceController;

        /**Accepts an invitation to join a group */
        acceptInvite(inviteCode: string): Promise<string>;

        /** Accepts a channel admin invitation and promotes the current user to a channel admin */
        acceptChannelAdminInvite(channelId: string): Promise<boolean>;

        /** Revokes a channel admin invitation sent to a user by a channel owner */
        revokeChannelAdminInvite(
            channelId: string,
            userId: string,
        ): Promise<boolean>;

        /** Demotes a channel admin to a regular subscriber (can be used also for self-demotion) */
        demoteChannelAdmin(channelId: string, userId: string): Promise<boolean>;

        /** Accepts a private invitation to join a group (v4 invite) */
        acceptGroupV4Invite: (
            inviteV4: InviteV4Data,
        ) => Promise<{ status: number }>;

        /**Returns an object with information about the invite code's group */
        getInviteInfo(inviteCode: string): Promise<object>;

        /** Enables and returns the archive state of the Chat */
        archiveChat(chatId: string): Promise<boolean>;

        /** Pins the Chat and returns its new Pin state */
        pinChat(chatId: string): Promise<boolean>;

        /** Unpins the Chat and returns its new Pin state */
        unpinChat(chatId: string): Promise<boolean>;

        /** Creates a new group */
        createGroup(
            title: string,
            participants?: string | Contact | Contact[] | string[],
            options?: CreateGroupOptions,
        ): Promise<CreateGroupResult | string>;

        /** Creates a new channel */
        createChannel(
            title: string,
            options?: CreateChannelOptions,
        ): Promise<CreateChannelResult | string>;

        /** Deletes the channel you created */
        deleteChannel(channelId: string): Promise<boolean>;

        /** Subscribe to channel */
        subscribeToChannel(channelId: string): Promise<boolean>;

        /** Unsubscribe from channel */
        unsubscribeFromChannel(
            channelId: string,
            options?: UnsubscribeOptions,
        ): Promise<boolean>;

        /**
         * Searches for channels based on search criteria, there are some notes:
         * 1. The method finds only channels you are not subscribed to currently
         * 2. If you have never been subscribed to a found channel
         * or you have unsubscribed from it with {@link UnsubscribeOptions.deleteLocalModels} set to 'true',
         * the lastMessage property of a found channel will be 'null'
         */
        searchChannels(
            searchOptions: SearchChannelsOptions,
        ): Promise<Array<Channel> | []>;

        /** Closes the client */
        destroy(): Promise<void>;

        /** Logs out the client, closing the current session */
        logout(): Promise<void>;

        /** Get all blocked contacts by host account */
        getBlockedContacts(): Promise<Contact[]>;

        /** Gets chat or channel instance by ID */
        getChatById(chatId: string): Promise<Chat>;

        /** Gets a {@link Channel} instance by invite code */
        getChannelByInviteCode(inviteCode: string): Promise<Channel>;

        /** Get all current chat instances */
        getChats(): Promise<Chat[]>;

        /** Gets all cached {@link Channel} instances */
        getChannels(): Promise<Channel[]>;

        /** Get contact instance by ID */
        getContactById(contactId: string): Promise<Contact>;

        /** Get message by ID */
        getMessageById(messageId: string): Promise<Message>;

        /** Gets instances of all pinned messages in a chat */
        getPinnedMessages(chatId: string): Promise<[Message] | []>;

        /** Get all current contact instances */
        getContacts(): Promise<Contact[]>;

        /** Get the country code of a WhatsApp ID. (154185968@c.us) => (1) */
        getCountryCode(number: string): Promise<string>;

        /** Get the formatted number of a WhatsApp ID. (12345678901@c.us) => (+1 (234) 5678-901) */
        getFormattedNumber(number: string): Promise<string>;

        /** Get all current Labels  */
        getLabels(): Promise<Label[]>;

        /** Get all current Broadcasts  */
        getBroadcasts(): Promise<Broadcast[]>;

        /** Get broadcast instance by current user ID */
        getBroadcastById(contactId: string): Promise<Broadcast>;

        /** Revoke current own status messages */
        revokeStatusMessage(messageId: string): Promise<void>;

        /** Change labels in chats  */
        addOrRemoveLabels(
            labelIds: Array<number | string>,
            chatIds: Array<string>,
        ): Promise<void>;

        /** Get Label instance by ID */
        getLabelById(labelId: string): Promise<Label>;

        /** Get all Labels assigned to a Chat */
        getChatLabels(chatId: string): Promise<Label[]>;

        /** Get all Chats for a specific Label */
        getChatsByLabelId(labelId: string): Promise<Chat[]>;

        /** Returns the contact ID's profile picture URL, if privacy settings allow it */
        getProfilePicUrl(contactId: string): Promise<string>;

        /** Gets the Contact's common groups with you. Returns empty array if you don't have any common group. */
        getCommonGroups(contactId: string): Promise<ChatId[]>;

        /** Gets the current connection state for the client */
        getState(): Promise<WAState>;

        /** Returns the version of WhatsApp Web currently being run */
        getWWebVersion(): Promise<string>;

        /** Sets up events and requirements, kicks off authentication request */
        initialize(): Promise<void>;

        /** Check if a given ID is registered in whatsapp */
        isRegisteredUser(contactId: string): Promise<boolean>;

        /** Get the registered WhatsApp ID for a number. Returns null if the number is not registered on WhatsApp. */
        getNumberId(number: string): Promise<ContactId | null>;

        /**
         * Mutes this chat forever, unless a date is specified
         * @param chatId ID of the chat that will be muted
         * @param unmuteDate Date when the chat will be unmuted, leave as is to mute forever
         */
        muteChat(
            chatId: string,
            unmuteDate?: Date,
        ): Promise<{ isMuted: boolean; muteExpiration: number }>;

        /**
         * Request authentication via pairing code instead of QR code
         * @param phoneNumber - Phone number in international, symbol-free format (e.g. 12025550108 for US, 551155501234 for Brazil)
         * @param showNotification - Show notification to pair on phone number. Defaults to `true`
         * @param intervalMs - The interval in milliseconds on how frequent to generate pairing code (WhatsApp default to 3 minutes). Defaults to `180000`
         * @returns {Promise<string>} - Returns a pairing code in format "ABCDEFGH"
         */
        requestPairingCode(
            phoneNumber: string,
            showNotification?: boolean,
            intervalMs?: number,
        ): Promise<string>;

        /** Cancels an active pairing code session and returns to QR code mode */
        cancelPairingCode(): Promise<void>

        /** Force reset of connection state for the client */
        resetState(): Promise<void>;

        /** Send a message to a specific chatId */
        sendMessage(
            chatId: string,
            content: MessageContent,
            options?: MessageSendOptions,
        ): Promise<Message>;

        /** Sends a channel admin invitation to a user, allowing them to become an admin of the channel */
        sendChannelAdminInvite(
            chatId: string,
            channelId: string,
            options?: { comment?: string },
        ): Promise<boolean>;

        /** Searches for messages */
        searchMessages(
            query: string,
            options?: { chatId?: string; page?: number; limit?: number },
        ): Promise<Message[]>;

        /** Marks the client as online */
        sendPresenceAvailable(): Promise<void>;

        /** Marks the client as offline */
        sendPresenceUnavailable(): Promise<void>;

        /** Mark as seen for the Chat */
        sendSeen(chatId: string): Promise<boolean>;

        /** Mark the Chat as unread */
        markChatUnread(chatId: string): Promise<void>;

        /**
         * Sets the current user's status message
         * @param status New status message
         */
        setStatus(status: string): Promise<void>;

        /**
         * Sets the current user's display name
         * @param displayName New display name
         */
        setDisplayName(displayName: string): Promise<boolean>;

        /**
         * Changes the autoload Audio
         * @param flag true/false on or off
         */
        setAutoDownloadAudio(flag: boolean): Promise<void>;
        /**
         * Changes the autoload Documents
         * @param flag true/false on or off
         */
        setAutoDownloadDocuments(flag: boolean): Promise<void>;
        /**
         * Changes the autoload Photos
         * @param flag true/false on or off
         */
        setAutoDownloadPhotos(flag: boolean): Promise<void>;
        /**
         * Changes the autoload Videos
         * @param flag true/false on or off
         */
        setAutoDownloadVideos(flag: boolean): Promise<void>;

        /**
         * Changing the background synchronization setting.
         * NOTE: this action will take effect after you restart the client.
         * @param flag true/false on or off
         */
        setBackgroundSync(flag: boolean): Promise<void>;

        /**
         * Get user device count by ID
         * Each WaWeb Connection counts as one device, and the phone (if exists) counts as one
         * So for a non-enterprise user with one WaWeb connection it should return "2"
         * @param {string} contactId
         */
        getContactDeviceCount(userId: string): Promise<number>;

        /** Sync history conversation of the Chat */
        syncHistory(chatId: string): Promise<boolean>;

        /** Save new contact to user's addressbook or edit the existing one */
        saveOrEditAddressbookContact(
            phoneNumber: string,
            firstName: string,
            lastName: string,
            syncToAddressbook?: boolean,
        ): Promise<void>;

        /**
         * Add or edit a customer note
         * @see https://faq.whatsapp.com/1433099287594476
         */
        addOrEditCustomerNote(userId: string, note: string): Promise<void>;

        /**
         * Get a customer note
         * @see https://faq.whatsapp.com/1433099287594476
         */
        getCustomerNote(userId: string): Promise<{
            chatId: string;
            content: string;
            createdAt: number;
            id: string;
            modifiedAt: number;
            type: string;
        }>;

        /** Deletes the contact from user's addressbook */
        deleteAddressbookContact(honeNumber: string): Promise<void>;

        /** Get Contact lid and phone */
        getContactLidAndPhone(
            userIds: string[],
        ): Promise<{ lid: string; pn: string }[]>;

        /** Changes and returns the archive state of the Chat */
        unarchiveChat(chatId: string): Promise<boolean>;

        /** Unmutes the Chat */
        unmuteChat(
            chatId: string,
        ): Promise<{ isMuted: boolean; muteExpiration: number }>;

        /** Sets the current user's profile picture */
        setProfilePicture(media: MessageMedia): Promise<boolean>;

        /** Deletes the current user's profile picture */
        deleteProfilePicture(): Promise<boolean>;

        /** Generates a WhatsApp call link (video call or voice call) */
        createCallLink(startTime: Date, callType: string): Promise<string>;

        /**
         * Sends a response to the scheduled event message, indicating whether a user is going to attend the event or not
         * @param response The response code to the event message. Valid values are: `0` for NONE response (removes a previous response) | `1` for GOING | `2` for NOT GOING | `3` for MAYBE going
         * @param eventMessageId The event message ID
         */
        sendResponseToScheduledEvent(
            response: number,
            eventMessageId: string,
        ): Promise<boolean>;

        /** Gets an array of membership requests */
        getGroupMembershipRequests(
            groupId: string,
        ): Promise<Array<GroupMembershipRequest>>;

        /** Approves membership requests if any */
        approveGroupMembershipRequests(
            groupId: string,
            options: MembershipRequestActionOptions,
        ): Promise<Array<MembershipRequestActionResult>>;

        /** Rejects membership requests if any */
        rejectGroupMembershipRequests(
            groupId: string,
            options: MembershipRequestActionOptions,
        ): Promise<Array<MembershipRequestActionResult>>;

        /**
         * Transfers a channel ownership to another user.
         * Note: the user you are transferring the channel ownership to must be a channel admin.
         */
        transferChannelOwnership(
            channelId: string,
            newOwnerId: string,
            options?: TransferChannelOwnershipOptions,
        ): Promise<boolean>;

        /** Get Poll Votes */
        getPollVotes(messageId: string): Promise<PollVote[]>;

        /** Generic event */
        on(event: string, listener: (...args: any) => void): this;

        /** Emitted when there has been an error while trying to restore an existing session */
        on(event: 'auth_failure', listener: (message: string) => void): this;

        /** Emitted when authentication is successful */
        on(event: 'authenticated', listener: () => void): this;

        /**
         * Emitted when the battery percentage for the attached device changes
         * @deprecated
         */
        on(
            event: 'change_battery',
            listener: (batteryInfo: BatteryInfo) => void,
        ): this;

        /** Emitted when the connection state changes */
        on(
            event: 'change_state',
            listener: (
                /** the new connection state */
                state: WAState,
            ) => void,
        ): this;

        /** Emitted when the client has been disconnected */
        on(
            event: 'disconnected',
            listener: (
                /** reason that caused the disconnect */
                reason: WAState | 'LOGOUT',
            ) => void,
        ): this;

        /** Emitted when a user joins the chat via invite link or is added by an admin */
        on(
            event: 'group_join',
            listener: (
                /** GroupNotification with more information about the action */
                notification: GroupNotification,
            ) => void,
        ): this;

        /** Emitted when a user leaves the chat or is removed by an admin */
        on(
            event: 'group_leave',
            listener: (
                /** GroupNotification with more information about the action */
                notification: GroupNotification,
            ) => void,
        ): this;

        /** Emitted when a current user is promoted to an admin or demoted to a regular user */
        on(
            event: 'group_admin_changed',
            listener: (
                /** GroupNotification with more information about the action */
                notification: GroupNotification,
            ) => void,
        ): this;

        /**
         * Emitted when some user requested to join the group
         * that has the membership approval mode turned on
         */
        on(
            event: 'group_membership_request',
            listener: (
                /** GroupNotification with more information about the action */
                notification: GroupNotification,
            ) => void,
        ): this;

        /** Emitted when group settings are updated, such as subject, description or picture */
        on(
            event: 'group_update',
            listener: (
                /** GroupNotification with more information about the action */
                notification: GroupNotification,
            ) => void,
        ): this;

        /** Emitted when a contact or a group participant changed their phone number. */
        on(
            event: 'contact_changed',
            listener: (
                /** Message with more information about the event. */
                message: Message,
                /** Old user's id. */
                oldId: String,
                /** New user's id. */
                newId: String,
                /** Indicates if a contact or a group participant changed their phone number. */
                isContact: Boolean,
            ) => void,
        ): this;

        /** Emitted when media has been uploaded for a message sent by the client */
        on(
            event: 'media_uploaded',
            listener: (
                /** The message with media that was uploaded */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when a new message is received */
        on(
            event: 'message',
            listener: (
                /** The message that was received */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when an ack event occurrs on message type */
        on(
            event: 'message_ack',
            listener: (
                /** The message that was affected */
                message: Message,
                /** The new ACK value */
                ack: MessageAck,
            ) => void,
        ): this;

        /** Emitted when an edit event occurrs on message type */
        on(
            event: 'message_edit',
            listener: (
                /** The message that was affected */
                message: Message,
                /** New text message */
                newBody: String,
                /** Prev text message */
                prevBody: String,
            ) => void,
        ): this;

        /** Emitted when a chat unread count changes */
        on(
            event: 'unread_count',
            listener: (
                /** The chat that was affected */
                chat: Chat,
            ) => void,
        ): this;

        /** Emitted when a new message is created, which may include the current user's own messages */
        on(
            event: 'message_create',
            listener: (
                /** The message that was created */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when a new message ciphertext is received  */
        on(
            event: 'message_ciphertext',
            listener: (
                /** The message that was ciphertext */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when a ciphertext message failed to decrypt after recovery attempt */
        on(
            event: 'message_ciphertext_failed',
            listener: (
                /** The message that failed to decrypt */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when a message is deleted for everyone in the chat */
        on(
            event: 'message_revoke_everyone',
            listener: (
                /** The message that was revoked, in its current state. It will not contain the original message's data */
                message: Message,
                /**The message that was revoked, before it was revoked.
                 * It will contain the message's original data.
                 * Note that due to the way this data is captured,
                 * it may be possible that this param will be undefined. */
                revoked_msg?: Message | null,
            ) => void,
        ): this;

        /** Emitted when a message is deleted by the current user */
        on(
            event: 'message_revoke_me',
            listener: (
                /** The message that was revoked */
                message: Message,
            ) => void,
        ): this;

        /** Emitted when a reaction is sent, received, updated or removed */
        on(
            event: 'message_reaction',
            listener: (
                /** The reaction object */
                reaction: Reaction,
            ) => void,
        ): this;

        /** Emitted when a chat is removed */
        on(
            event: 'chat_removed',
            listener: (
                /** The chat that was removed */
                chat: Chat,
            ) => void,
        ): this;

        /** Emitted when a chat is archived/unarchived */
        on(
            event: 'chat_archived',
            listener: (
                /** The chat that was archived/unarchived */
                chat: Chat,
                /** State the chat is currently in */
                currState: boolean,
                /** State the chat was previously in */
                prevState: boolean,
            ) => void,
        ): this;

        /** Emitted when loading screen is appearing */
        on(
            event: 'loading_screen',
            listener: (percent: string, message: string) => void,
        ): this;

        /** Emitted when the QR code is received */
        on(
            event: 'qr',
            listener: (
                /** qr code string
                 *  @example ```1@9Q8tWf6bnezr8uVGwVCluyRuBOJ3tIglimzI5dHB0vQW2m4DQ0GMlCGf,f1/vGcW4Z3vBa1eDNl3tOjWqLL5DpYTI84DMVkYnQE8=,ZL7YnK2qdPN8vKo2ESxhOQ==``` */
                qr: string,
            ) => void,
        ): this;

        /** Emitted when the phone number pairing code is received */
        on(
            event: 'code',
            listener: (
                /** pairing code string
                 *  @example `8W2WZ3TS` */
                code: string,
            ) => void,
        ): this;

        /** Emitted when a call is received */
        on(
            event: 'call',
            listener: (
                /** The call that started */
                call: Call,
            ) => void,
        ): this;

        /** Emitted when the client has initialized and is ready to receive messages */
        on(event: 'ready', listener: () => void): this;

        /** Emitted when the RemoteAuth session is saved successfully on the external Database */
        on(event: 'remote_session_saved', listener: () => void): this;

        /**
         * Emitted when some poll option is selected or deselected,
         * shows a user's current selected option(s) on the poll
         */
        on(event: 'vote_update', listener: (vote: PollVote) => void): this;
    }

    /** Current connection information */
    export interface ClientInfo {
        /**
         * Current user ID
         * @deprecated Use .wid instead
         */
        me: ContactId;
        /** Current user ID */
        wid: ContactId;
        /**
         * Information about the phone this client is connected to.  Not available in multi-device.
         * @deprecated
         */
        phone: ClientInfoPhone;
        /** Platform the phone is running on */
        platform: string;
        /** Name configured to be shown in push notifications */
        pushname: string;

        /** Get current battery percentage and charging status for the attached device */
        getBatteryStatus: () => Promise<BatteryInfo>;
    }

    /**
     * Information about the phone this client is connected to
     * @deprecated
     */
    export interface ClientInfoPhone {
        /** WhatsApp Version running on the phone */
        wa_version: string;
        /** OS Version running on the phone (iOS or Android version) */
        os_version: string;
        /** Device manufacturer */
        device_manufacturer: string;
        /** Device model */
        device_model: string;
        /** OS build number */
        os_build_number: string;
    }

    /** Options for initializing the whatsapp client */
    export interface ClientOptions {
        /** Timeout for authentication selector in puppeteer
         * @default 0 */
        authTimeoutMs?: number;
        /** function to be evaluated On New Document
         * @default undefined */
        evalOnNewDoc?: Function;
        /** Puppeteer launch options. View docs here: https://github.com/puppeteer/puppeteer/ */
        puppeteer?: puppeteer.PuppeteerNodeLaunchOptions &
            puppeteer.ConnectOptions;
        /** Determines how to save and restore sessions. Will use LegacySessionAuth if options.session is set. Otherwise, NoAuth will be used. */
        authStrategy?: AuthStrategy;
        /** The version of WhatsApp Web to use. Use options.webVersionCache to configure how the version is retrieved. */
        webVersion?: string;
        /**  Determines how to retrieve the WhatsApp Web version specified in options.webVersion. */
        webVersionCache?: WebCacheOptions;
        /** How many times should the qrcode be refreshed before giving up
         * @default 0 (disabled) */
        qrMaxRetries?: number;
        /** If another whatsapp web session is detected (another browser), take over the session in the current browser
         * @default false */
        takeoverOnConflict?: boolean;
        /** How much time to wait before taking over the session
         * @default 0 */
        takeoverTimeoutMs?: number;
        /** User agent to use in puppeteer.
         * @default 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36' */
        userAgent?: string;
        /** Ffmpeg path to use when formatting videos to webp while sending stickers
         * @default 'ffmpeg' */
        ffmpegPath?: string;
        /** Sets bypassing of page's Content-Security-Policy
         * @default false */
        bypassCSP?: boolean;
        /** Sets the device name of a current linked device., i.e.: 'TEST' */
        deviceName?: string;
        /**
         * Sets the browser name of a current linked device, i.e.: 'Firefox'.
         * Valid value are: 'Chrome' | 'Firefox' | 'IE' | 'Opera' | 'Safari' | 'Edge'
         */
        browserName?: string;
        /** Object with proxy autentication requirements @default: undefined */
        proxyAuthentication?:
            | { username: string; password: string }
            | undefined;
        /** Phone number pairing configuration. Refer the requestPairingCode function of Client.
         * @default
         * {
         *   phoneNumber: "",
         *   showNotification: true,
         *   intervalMs: 180000,
         * }
         */
        pairWithPhoneNumber?: {
            phoneNumber: string;
            showNotification?: boolean;
            intervalMs?: number;
        };
    }

    export interface LocalWebCacheOptions {
        type: 'local';
        path?: string;
        strict?: boolean;
    }

    export interface RemoteWebCacheOptions {
        type: 'remote';
        remotePath: string;
        strict?: boolean;
    }

    export interface NoWebCacheOptions {
        type: 'none';
    }

    export type WebCacheOptions =
        | NoWebCacheOptions
        | LocalWebCacheOptions
        | RemoteWebCacheOptions;

    /**
     * Base class which all authentication strategies extend
     */
    export abstract class AuthStrategy {
        setup: (client: Client) => void;
        beforeBrowserInitialized: () => Promise<void>;
        afterBrowserInitialized: () => Promise<void>;
        onAuthenticationNeeded: () => Promise<{
            failed?: boolean;
            restart?: boolean;
            failureEventPayload?: any;
        }>;
        getAuthEventPayload: () => Promise<any>;
        afterAuthReady: () => Promise<void>;
        disconnect: () => Promise<void>;
        destroy: () => Promise<void>;
        logout: () => Promise<void>;
    }

    /**
     * No session restoring functionality
     * Will need to authenticate via QR code every time
     */
    export class NoAuth extends AuthStrategy {}

    /**
     * Local directory-based authentication
     */
    export class LocalAuth extends AuthStrategy {
        public clientId?: string;
        public dataPath?: string;
        constructor(options?: {
            clientId?: string;
            dataPath?: string;
            rmMaxRetries?: number;
        });
    }

    /**
     * Remote-based authentication
     */
    export class RemoteAuth extends AuthStrategy {
        public clientId?: string;
        public dataPath?: string;
        constructor(options?: {
            store: Store;
            clientId?: string;
            dataPath?: string;
            backupSyncIntervalMs: number;
            rmMaxRetries?: number;
        });
    }

    /**
     * Remote store interface
     */
    export interface Store {
        sessionExists: (options: {
            session: string;
        }) => Promise<boolean> | boolean;
        delete: (options: { session: string }) => Promise<any> | any;
        save: (options: { session: string }) => Promise<any> | any;
        extract: (options: {
            session: string;
            path: string;
        }) => Promise<any> | any;
    }

    /**
     * @deprecated
     */
    export interface BatteryInfo {
        /** The current battery percentage */
        battery: number;
        /** Indicates if the phone is plugged in (true) or not (false) */
        plugged: boolean;
    }

    /** An object that handles options for group creation */
    export interface CreateGroupOptions {
        /**
         * The number of seconds for the messages to disappear in the group,
         * won't take an effect if the group is been creating with myself only
         * @default 0
         */
        messageTimer?: number;
        /**
         * The ID of a parent community group to link the newly created group with,
         * won't take an effect if the group is been creating with myself only
         */
        parentGroupId?: string;
        /** If true, the inviteV4 will be sent to those participants
         * who have restricted others from being automatically added to groups,
         * otherwise the inviteV4 won't be sent
         * @default true
         */
        autoSendInviteV4?: boolean;
        /**
         * The comment to be added to an inviteV4 (empty string by default)
         * @default ''
         */
        comment?: string;
        /** If true, only admins can add members to the group (false by default)
         * @default false
         */
        memberAddMode?: boolean;
        /** If true, group admins will be required to approve anyone who wishes to join the group (false by default)
         * @default false
         */
        membershipApprovalMode?: boolean;
        /** If true, only admins can change group group info (true by default)
         * @default true
         */
        isRestrict?: boolean;
        /** If true, only admins can send messages (false by default)
         * @default false
         */
        isAnnounce?: boolean;
    }

    /** An object that handles the result for createGroup method */
    export interface CreateGroupResult {
        /** A group title */
        title: string;
        /** An object that handles the newly created group ID */
        gid: ChatId;
        /** An object that handles the result value for each added to the group participant */
        participants: {
            [participantId: string]: {
                statusCode: number;
                message: string;
                isGroupCreator: boolean;
                isInviteV4Sent: boolean;
            };
        };
    }

    /** An object that handles options for channel creation */
    export interface CreateChannelOptions {
        /** The channel description */
        description?: string;
        /** The channel profile picture */
        picture?: MessageMedia;
    }

    /** An object that handles the result for createGroup method */
    export interface CreateChannelResult {
        /** A channel title */
        title: string;
        /** An object that handles the newly created channel ID */
        nid: ChatId;
        /** The channel invite link, starts with 'https://whatsapp.com/channel/' */
        inviteLink: string;
        /** The timestamp the channel was created at */
        createdAtTs: number;
    }

    /** Options for unsubscribe from a channel */
    export interface UnsubscribeOptions {
        /**
         * If true, after an unsubscription, it will completely remove a channel from the channel collection
         * making it seem like the current user have never interacted with it.
         * Otherwise it will only remove a channel from the list of channels the current user is subscribed to
         * and will set the membership type for that channel to GUEST
         */
        deleteLocalModels?: boolean;
    }

    /** Options for searching for channels */
    export interface SearchChannelsOptions {
        searchText?: string;
        countryCodes?: string[];
        skipSubscribedNewsletters?: boolean;
        view?: number;
        limit?: number;
    }

    export interface GroupNotification {
        /** ContactId for the user that produced the GroupNotification */
        author: string;
        /** Extra content */
        body: string;
        /** ID for the Chat that this groupNotification was sent for */
        chatId: string;
        /** ID that represents the groupNotification
         *  @todo create a more specific type for the id object */
        id: object;
        /** Contact IDs for the users that were affected by this GroupNotification */
        recipientIds: string[];
        /** Unix timestamp for when the groupNotification was created */
        timestamp: number;
        /** GroupNotification type */
        type: GroupNotificationTypes;

        /** Returns the Chat this GroupNotification was sent in */
        getChat: () => Promise<Chat>;
        /** Returns the Contact this GroupNotification was produced by */
        getContact: () => Promise<Contact>;
        /** Returns the Contacts affected by this GroupNotification */
        getRecipients: () => Promise<Contact[]>;
        /** Sends a message to the same chat this GroupNotification was produced in */
        reply: (
            content: MessageContent,
            options?: MessageSendOptions,
        ) => Promise<Message>;
    }

    /** whatsapp web url */
    export const WhatsWebURL: string;

    /** default client options */
    export const DefaultOptions: ClientOptions;

    /** Chat types */
    export enum ChatTypes {
        SOLO = 'solo',
        GROUP = 'group',
        UNKNOWN = 'unknown',
    }

    /** Events that can be emitted by the client */
    export enum Events {
        AUTHENTICATED = 'authenticated',
        AUTHENTICATION_FAILURE = 'auth_failure',
        READY = 'ready',
        CHAT_REMOVED = 'chat_removed',
        CHAT_ARCHIVED = 'chat_archived',
        MESSAGE_RECEIVED = 'message',
        MESSAGE_CIPHERTEXT = 'message_ciphertext',
        MESSAGE_CIPHERTEXT_FAILED = 'message_ciphertext_failed',
        MESSAGE_CREATE = 'message_create',
        MESSAGE_REVOKED_EVERYONE = 'message_revoke_everyone',
        MESSAGE_REVOKED_ME = 'message_revoke_me',
        MESSAGE_ACK = 'message_ack',
        MESSAGE_EDIT = 'message_edit',
        UNREAD_COUNT = 'unread_count',
        MESSAGE_REACTION = 'message_reaction',
        MEDIA_UPLOADED = 'media_uploaded',
        CONTACT_CHANGED = 'contact_changed',
        GROUP_JOIN = 'group_join',
        GROUP_LEAVE = 'group_leave',
        GROUP_ADMIN_CHANGED = 'group_admin_changed',
        GROUP_MEMBERSHIP_REQUEST = 'group_membership_request',
        GROUP_UPDATE = 'group_update',
        QR_RECEIVED = 'qr',
        CODE_RECEIVED = 'code',
        LOADING_SCREEN = 'loading_screen',
        CALL = 'call',
        DISCONNECTED = 'disconnected',
        STATE_CHANGED = 'change_state',
        BATTERY_CHANGED = 'change_battery',
        REMOTE_SESSION_SAVED = 'remote_session_saved',
        INCOMING_CALL = 'call',
        VOTE_UPDATE = 'vote_update',
    }

    /** Group notification types */
    export enum GroupNotificationTypes {
        ADD = 'add',
        INVITE = 'invite',
        REMOVE = 'remove',
        LEAVE = 'leave',
        PROMOTE = 'promote',
        DEMOTE = 'demote',
        SUBJECT = 'subject',
        DESCRIPTION = 'description',
        PICTURE = 'picture',
        ANNOUNCE = 'announce',
        RESTRICT = 'restrict',
    }

    /** Message ACK */
    export enum MessageAck {
        ACK_ERROR = -1,
        ACK_PENDING = 0,
        ACK_SERVER = 1,
        ACK_DEVICE = 2,
        ACK_READ = 3,
        ACK_PLAYED = 4,
    }

    /** Message types */
    export enum MessageTypes {
        TEXT = 'chat',
        AUDIO = 'audio',
        VOICE = 'ptt',
        IMAGE = 'image',
        ALBUM = 'album',
        VIDEO = 'video',
        DOCUMENT = 'document',
        STICKER = 'sticker',
        LOCATION = 'location',
        CONTACT_CARD = 'vcard',
        CONTACT_CARD_MULTI = 'multi_vcard',
        REVOKED = 'revoked',
        ORDER = 'order',
        PRODUCT = 'product',
        PAYMENT = 'payment',
        UNKNOWN = 'unknown',
        GROUP_INVITE = 'groups_v4_invite',
        LIST = 'list',
        LIST_RESPONSE = 'list_response',
        BUTTONS_RESPONSE = 'buttons_response',
        BROADCAST_NOTIFICATION = 'broadcast_notification',
        CALL_LOG = 'call_log',
        CIPHERTEXT = 'ciphertext',
        DEBUG = 'debug',
        E2E_NOTIFICATION = 'e2e_notification',
        GP2 = 'gp2',
        GROUP_NOTIFICATION = 'group_notification',
        HSM = 'hsm',
        INTERACTIVE = 'interactive',
        NATIVE_FLOW = 'native_flow',
        NOTIFICATION = 'notification',
        NOTIFICATION_TEMPLATE = 'notification_template',
        OVERSIZED = 'oversized',
        PROTOCOL = 'protocol',
        REACTION = 'reaction',
        TEMPLATE_BUTTON_REPLY = 'template_button_reply',
        POLL_CREATION = 'poll_creation',
        SCHEDULED_EVENT_CREATION = 'scheduled_event_creation',
    }

    /** Client status */
    export enum Status {
        INITIALIZING = 0,
        AUTHENTICATING = 1,
        READY = 3,
    }

    /** WhatsApp state */
    export enum WAState {
        CONFLICT = 'CONFLICT',
        CONNECTED = 'CONNECTED',
        DEPRECATED_VERSION = 'DEPRECATED_VERSION',
        OPENING = 'OPENING',
        PAIRING = 'PAIRING',
        PROXYBLOCK = 'PROXYBLOCK',
        SMB_TOS_BLOCK = 'SMB_TOS_BLOCK',
        TIMEOUT = 'TIMEOUT',
        TOS_BLOCK = 'TOS_BLOCK',
        UNLAUNCHED = 'UNLAUNCHED',
        UNPAIRED = 'UNPAIRED',
        UNPAIRED_IDLE = 'UNPAIRED_IDLE',
    }

    export type MessageInfo = {
        delivery: Array<{ id: ContactId; t: number }>;
        deliveryRemaining: number;
        played: Array<{ id: ContactId; t: number }>;
        playedRemaining: number;
        read: Array<{ id: ContactId; t: number }>;
        readRemaining: number;
    };

    export type InviteV4Data = {
        inviteCode: string;
        inviteCodeExp: number;
        groupId: string;
        groupName?: string;
        fromId: string;
        toId: string;
    };

    /**
     * Represents a Message on WhatsApp
     *
     * @example
     * {
     *   mediaKey: undefined,
     *   id: {
     *     fromMe: false,
     *     remote: `554199999999@c.us`,
     *     id: '1234567890ABCDEFGHIJ',
     *     _serialized: `false_554199999999@c.us_1234567890ABCDEFGHIJ`
     *   },
     *   ack: -1,
     *   hasMedia: false,
     *   body: 'Hello!',
     *   type: 'chat',
     *   timestamp: 1591482682,
     *   from: `554199999999@c.us`,
     *   to: `554188888888@c.us`,
     *   author: undefined,
     *   isForwarded: false,
     *   broadcast: false,
     *   fromMe: false,
     *   hasQuotedMsg: false,
     *   hasReaction: false,
     *   location: undefined,
     *   mentionedIds: []
     * }
     */
    export interface Message {
        /** ACK status for the message */
        ack: MessageAck;
        /** If the message was sent to a group, this field will contain the user that sent the message. */
        author?: string;
        /** String that represents from which device type the message was sent */
        deviceType: string;
        /** Message content */
        body: string;
        /** Indicates if the message was a broadcast */
        broadcast: boolean;
        /** Indicates if the message was a status update */
        isStatus: boolean;
        /** Indicates if the message is a Gif */
        isGif: boolean;
        /** Indicates if the message will disappear after it expires */
        isEphemeral: boolean;
        /** ID for the Chat that this message was sent to, except if the message was sent by the current user */
        from: string;
        /** Indicates if the message was sent by the current user */
        fromMe: boolean;
        /** Indicates if the message has media available for download */
        hasMedia: boolean;
        /** Indicates if the message was sent as a reply to another message */
        hasQuotedMsg: boolean;
        /** Indicates whether there are reactions to the message */
        hasReaction: boolean;
        /** Indicates the duration of the message in seconds */
        duration: string;
        /** ID that represents the message */
        id: MessageId;
        /** Indicates if the message was forwarded */
        isForwarded: boolean;
        /**
         * Indicates how many times the message was forwarded.
         * The maximum value is 127.
         */
        forwardingScore: number;
        /** Indicates if the message was starred */
        isStarred: boolean;
        /** Location information contained in the message, if the message is type "location" */
        location: Location;
        /** List of vCards contained in the message */
        vCards: string[];
        /** Invite v4 info */
        inviteV4?: InviteV4Data;
        /** MediaKey that represents the sticker 'ID' */
        mediaKey?: string;
        /** Indicates the mentions in the message body. */
        mentionedIds: string[];
        /** Indicates whether there are group mentions in the message body */
        groupMentions: {
            groupSubject: string;
            groupJid: string;
        }[];
        /** Unix timestamp for when the message was created */
        timestamp: number;
        /**
         * ID for who this message is for.
         * If the message is sent by the current user, it will be the Chat to which the message is being sent.
         * If the message is sent by another user, it will be the ID for the current user.
         */
        to: string;
        /** Message type */
        type: MessageTypes;
        /** Links included in the message. */
        links: Array<{
            link: string;
            isSuspicious: boolean;
        }>;
        /** Order ID */
        orderId: string;
        /** title */
        title?: string;
        /** description*/
        description?: string;
        /** Business Owner JID */
        businessOwnerJid?: string;
        /** Product JID */
        productId?: string;
        /** Last edit time */
        latestEditSenderTimestampMs?: number;
        /** Last edit message author */
        latestEditMsgKey?: MessageId;
        /**
         * Protocol message key.
         * Can be used to retrieve the ID of an original message that was revoked.
         */
        protocolMessageKey?: MessageId;
        /** Message buttons */
        dynamicReplyButtons?: object;
        /** Selected button ID */
        selectedButtonId?: string;
        /** Selected list row ID */
        selectedRowId?: string;
        /** Returns message in a raw format */
        rawData: object;
        pollName: string;
        /** Avaiaible poll voting options */
        pollOptions: string[];
        /** False for a single choice poll, true for a multiple choice poll */
        allowMultipleAnswers: boolean;
        /** The start time of the event in timestamp (10 digits) */
        eventStartTime: number;
        /** The end time of the event in timestamp (10 digits) */
        eventEndTime?: number;
        /** The event description */
        eventDescription?: string;
        /** The location of the event */
        eventLocation?: {
            degreesLatitude: number;
            degreesLongitude: number;
            name: string;
        };
        /** WhatsApp call link (video call or voice call) */
        eventJoinLink?: string;
        /** Indicates if an event should be sent as an already canceled */
        isEventCaneled: boolean;
        /** The custom message secret, can be used as an event ID */
        messageSecret?: Array<number>;
        /*
         * Reloads this Message object's data in-place with the latest values from WhatsApp Web.
         * Note that the Message must still be in the web app cache for this to work, otherwise will return null.
         */
        reload: () => Promise<Message>;
        /** Accept the Group V4 Invite in message */
        acceptGroupV4Invite: () => Promise<{ status: number }>;
        /** Deletes the message from the chat */
        delete: (everyone?: boolean, clearMedia?: boolean) => Promise<void>;
        /** Downloads and returns the attached message media */
        downloadMedia: () => Promise<MessageMedia>;
        /** Returns the Chat this message was sent in */
        getChat: () => Promise<Chat>;
        /** Returns the Contact this message was sent from */
        getContact: () => Promise<Contact>;
        /** Returns the Contacts mentioned in this message */
        getMentions: () => Promise<Contact[]>;
        /** Returns groups mentioned in this message */
        getGroupMentions: () => Promise<GroupChat[] | []>;
        /** Returns the quoted message, if any */
        getQuotedMessage: () => Promise<Message>;
        /**
         * Sends a message as a reply to this message.
         * If chatId is specified, it will be sent through the specified Chat.
         * If not, it will send the message in the same Chat as the original message was sent.
         */
        reply: (
            content: MessageContent,
            chatId?: string,
            options?: MessageSendOptions,
        ) => Promise<Message>;
        /** React to this message with an emoji*/
        react: (reaction: string) => Promise<void>;
        /**
         * Forwards this message to another chat (that you chatted before, otherwise it will fail)
         */
        forward: (chat: Chat | string) => Promise<void>;
        /** Star this message */
        star: () => Promise<void>;
        /** Unstar this message */
        unstar: () => Promise<void>;
        /** Pins the message (group admins can pin messages of all group members) */
        pin: (duration: number) => Promise<boolean>;
        /** Unpins the message (group admins can unpin messages of all group members) */
        unpin: () => Promise<boolean>;
        /** Get information about message delivery status */
        getInfo: () => Promise<MessageInfo | null>;
        /**
         * Gets the order associated with a given message
         */
        getOrder: () => Promise<Order>;
        /**
         * Gets the payment details associated with a given message
         */
        getPayment: () => Promise<Payment>;
        /**
         * Get Poll Votes associated with the given message
         */
        getPollVotes: () => Promise<PollVote[]>;
        /**
         * Gets the reactions associated with the given message
         */
        getReactions: () => Promise<ReactionList[]>;
        /** Edits the current message */
        edit: (
            content: MessageContent,
            options?: MessageEditOptions,
        ) => Promise<Message | null>;
        /**
         * Edits the current ScheduledEvent message.
         * Once the event is canceled, it can not be edited.
         */
        editScheduledEvent: (
            editedEventObject: Event,
        ) => Promise<Message | null>;
        /**
         * Send votes to the poll message
         */
        vote: (selectedOptions: Array<string>) => Promise<void>;
    }

    /** ID that represents a message */
    export interface MessageId {
        fromMe: boolean;
        remote: string;
        id: string;
        _serialized: string;
    }

    /** Options for sending a location */
    export interface LocationSendOptions {
        /** Location name */
        name?: string;
        /** Location address */
        address?: string;
        /** URL address to be shown within a location message */
        url?: string;
    }

    /** Location information */
    export class Location {
        latitude: string;
        longitude: string;
        name?: string;
        address?: string;
        url?: string;
        description?: string;

        constructor(
            latitude: number,
            longitude: number,
            options?: LocationSendOptions,
        );
    }

    /** Poll send options */
    export interface PollSendOptions {
        /** False for a single choice poll, true for a multiple choice poll (false by default) */
        allowMultipleAnswers?: boolean;
        /**
         * The custom message secret, can be used as a poll ID
         * @note It has to be a unique vector with a length of 32
         */
        messageSecret: Array<number> | undefined;
    }

    /** Represents a Poll on WhatsApp */
    export class Poll {
        pollName: string;
        pollOptions: Array<{
            name: string;
            localId: number;
        }>;
        options: PollSendOptions;

        constructor(
            pollName: string,
            pollOptions: Array<string>,
            options?: PollSendOptions,
        );
    }

    /** ScheduledEvent send options */
    export interface ScheduledEventSendOptions {
        /** The scheduled event description */
        description?: string;
        /** The end time of the event */
        endTime?: Date;
        /** The location of the event */
        location?: string;
        /** The type of a WhatsApp call link to generate, valid values are: `video` | `voice` | `none` */
        callType?: string;
        /**
         * Indicates if a scheduled event should be sent as an already canceled
         * @default false
         */
        isEventCanceled?: boolean;
        /**
         * The custom message secret, can be used as an event ID
         * @note It has to be a unique vector with a length of 32
         */
        messageSecret: Array<number> | undefined;
    }

    /** Represents a ScheduledEvent on WhatsApp */
    export class ScheduledEvent {
        name: string;
        startTimeTs: number;
        eventSendOptions: {
            description?: string;
            endTimeTs?: number;
            location?: string;
            callType?: string;
            isEventCanceled?: boolean;
            messageSecret?: string;
        };

        constructor(
            name: string,
            startTime: Date,
            options?: ScheduledEventSendOptions,
        );
    }

    /** Represents a Poll Vote on WhatsApp */
    export interface PollVote {
        /** The person who voted */
        voter: string;

        /**
         * The selected poll option(s)
         * If it's an empty array, the user hasn't selected any options on the poll,
         * may occur when they deselected all poll options
         */
        selectedOptions: SelectedPollOption[];

        /** Timestamp the option was selected or deselected at */
        interractedAtTs: number;

        /** The poll creation message associated with the poll vote */
        parentMessage: Message;
    }

    /** Selected poll option structure */
    export interface SelectedPollOption {
        /** The local selected option ID */
        id: number;

        /** The option name */
        name: string;
    }

    export interface Label {
        /** Label name */
        name: string;
        /** Label ID */
        id: string;
        /** Color assigned to the label */
        hexColor: string;

        /** Get all chats that have been assigned this Label */
        getChats: () => Promise<Chat[]>;
    }

    export interface Broadcast {
        /** Chat Object ID */
        id: {
            server: string;
            user: string;
            _serialized: string;
        };
        /** Unix timestamp of last story */
        timestamp: number;
        /** Number of available statuses */
        totalCount: number;
        /** Number of not viewed */
        unreadCount: number;
        /** Unix timestamp of last story */
        msgs: Message[];

        /** Returns the Chat of the owner of the story */
        getChat: () => Promise<Chat>;
        /** Returns the Contact of the owner of the story */
        getContact: () => Promise<Contact>;
    }

    /** Options for sending a message */
    export interface MessageSendOptions {
        /** Show links preview. Has no effect on multi-device accounts. */
        linkPreview?: boolean;
        /** Send audio as voice message with a generated waveform */
        sendAudioAsVoice?: boolean;
        /** Send video as gif */
        sendVideoAsGif?: boolean;
        /** Send media as sticker */
        sendMediaAsSticker?: boolean;
        /** Send media as document */
        sendMediaAsDocument?: boolean;
        /** Send media as quality HD */
        sendMediaAsHd?: boolean;
        /** Send photo/video as a view once message */
        isViewOnce?: boolean;
        /** Automatically parse vCards and send them as contacts */
        parseVCards?: boolean;
        /** Image or videos caption */
        caption?: string;
        /** Id of the message that is being quoted (or replied to) */
        quotedMessageId?: string;
        /** User IDs to mention in the message */
        mentions?: string[];
        /** An array of object that handle group mentions */
        groupMentions?: {
            /** The name of a group to mention (can be custom) */
            subject: string;
            /** The group ID, e.g.: 'XXXXXXXXXX@g.us' */
            id: string;
        }[];
        /** Send 'seen' status */
        sendSeen?: boolean;
        /** Bot Wid when doing a bot mention like @Meta AI */
        invokedBotWid?: string;
        /** Media to be sent */
        media?: MessageMedia;
        /** Extra options */
        extra?: any;
        /** Sticker name, if sendMediaAsSticker is true */
        stickerName?: string;
        /** Sticker author, if sendMediaAsSticker is true */
        stickerAuthor?: string;
        /** Sticker categories, if sendMediaAsSticker is true */
        stickerCategories?: string[];
        /** Should the bot send a quoted message without the quoted message if it fails to get the quote?
         * @default true (enabled) */
        ignoreQuoteErrors?: boolean;
        /**
         * Should the bot wait for the message send result?
         * @default false
         */
        waitUntilMsgSent?: boolean;
    }

    /** Options for editing a message */
    export interface MessageEditOptions {
        /** Show links preview. Has no effect on multi-device accounts. */
        linkPreview?: boolean;
        /** User IDs of users that being mentioned in the message */
        mentions?: string[];
        /** Extra options */
        extra?: any;
    }

    export interface MediaFromURLOptions {
        client?: Client;
        filename?: string;
        unsafeMime?: boolean;
        reqOptions?: RequestInit;
    }

    /** Media attached to a message */
    export class MessageMedia {
        /** MIME type of the attachment */
        mimetype: string;
        /** Base64-encoded data of the file */
        data: string;
        /** Document file name. Value can be null */
        filename?: string | null;
        /** Document file size in bytes. Value can be null. */
        filesize?: number | null;

        /**
         * @param {string} mimetype MIME type of the attachment
         * @param {string} data Base64-encoded data of the file
         * @param {?string} filename Document file name. Value can be null
         * @param {?number} filesize Document file size in bytes. Value can be null.
         */
        constructor(
            mimetype: string,
            data: string,
            filename?: string | null,
            filesize?: number | null,
        );

        /** Creates a MessageMedia instance from a local file path */
        static fromFilePath: (filePath: string) => MessageMedia;

        /** Creates a MessageMedia instance from a URL */
        static fromUrl: (
            url: string,
            options?: MediaFromURLOptions,
        ) => Promise<MessageMedia>;
    }

    export type MessageContent =
        | string
        | MessageMedia
        | Location
        | Poll
        | Contact
        | Contact[]
        | List
        | Buttons
        | ScheduledEvent;

    /**
     * Represents a Contact on WhatsApp
     *
     * @example
     * {
     *   id: {
     *     server: 'c.us',
     *     user: '554199999999',
     *     _serialized: `554199999999@c.us`
     *   },
     *   number: '554199999999',
     *   isBusiness: false,
     *   isEnterprise: false,
     *   labels: [],
     *   name: undefined,
     *   pushname: 'John',
     *   sectionHeader: undefined,
     *   shortName: undefined,
     *   statusMute: false,
     *   type: 'in',
     *   verifiedLevel: undefined,
     *   verifiedName: undefined,
     *   isMe: false,
     *   isUser: true,
     *   isGroup: false,
     *   isWAContact: true,
     *   isMyContact: false
     * }
     */
    export interface Contact {
        /** Contact's phone number */
        number: string;
        /** Indicates if the contact is a business contact */
        isBusiness: boolean;
        /** ID that represents the contact */
        id: ContactId;
        /** Indicates if the contact is an enterprise contact */
        isEnterprise: boolean;
        /** Indicates if the contact is a group contact */
        isGroup: boolean;
        /** Indicates if the contact is the current user's contact */
        isMe: boolean;
        /** Indicates if the number is saved in the current phone's contacts */
        isMyContact: boolean;
        /** Indicates if the contact is a user contact */
        isUser: boolean;
        /** Indicates if the number is registered on WhatsApp */
        isWAContact: boolean;
        /** Indicates if you have blocked this contact */
        isBlocked: boolean;
        /** @todo verify labels type. didn't have any documentation */
        labels?: string[];
        /** The contact's name, as saved by the current user */
        name?: string;
        /** The name that the contact has configured to be shown publically */
        pushname: string;
        /** @todo missing documentation */
        sectionHeader: string;
        /** A shortened version of name */
        shortName?: string;
        /** Indicates if the status from the contact is muted */
        statusMute: boolean;
        /** @todo missing documentation */
        type: string;
        /** @todo missing documentation */
        verifiedLevel?: undefined;
        /** @todo missing documentation */
        verifiedName?: undefined;

        /** Returns the contact's profile picture URL, if privacy settings allow it */
        getProfilePicUrl: () => Promise<string>;

        /** Returns the Chat that corresponds to this Contact.
         * Will return null when getting chat for currently logged in user.
         */
        getChat: () => Promise<Chat>;

        /** Returns the contact's countrycode, (1541859685@c.us) => (1) */
        getCountryCode(): Promise<string>;

        /** Returns the contact's formatted phone number, (12345678901@c.us) => (+1 (234) 5678-901) */
        getFormattedNumber(): Promise<string>;

        /** Blocks this contact from WhatsApp */
        block: () => Promise<boolean>;

        /** Unlocks this contact from WhatsApp */
        unblock: () => Promise<boolean>;

        /** Gets the Contact's current "about" info. Returns null if you don't have permission to read their status.  */
        getAbout: () => Promise<string | null>;

        /** Gets the Contact's common groups with you. Returns empty array if you don't have any common group. */
        getCommonGroups: () => Promise<ChatId[]>;

        /** Gets the Contact's current status broadcast. */
        getBroadcast: () => Promise<Broadcast>;
    }

    export interface ContactId {
        server: string;
        user: string;
        _serialized: string;
    }

    export interface BusinessCategory {
        id: string;
        localized_display_name: string;
    }

    export interface BusinessHoursOfDay {
        mode: string;
        hours: number[];
    }

    export interface BusinessHours {
        config: {
            sun: BusinessHoursOfDay;
            mon: BusinessHoursOfDay;
            tue: BusinessHoursOfDay;
            wed: BusinessHoursOfDay;
            thu: BusinessHoursOfDay;
            fri: BusinessHoursOfDay;
        };
        timezone: string;
    }

    export interface BusinessContact extends Contact {
        /**
         * The contact's business profile
         */
        businessProfile: {
            /** The contact's business profile id */
            id: ContactId;

            /** The contact's business profile tag */
            tag: string;

            /** The contact's business profile description */
            description: string;

            /** The contact's business profile categories */
            categories: BusinessCategory[];

            /** The contact's business profile options */
            profileOptions: {
                /** The contact's business profile commerce experience*/
                commerceExperience: string;

                /** The contact's business profile cart options */
                cartEnabled: boolean;
            };

            /** The contact's business profile email */
            email: string;

            /** The contact's business profile websites */
            website: string[];

            /** The contact's business profile latitude */
            latitude: number;

            /** The contact's business profile longitude */
            longitude: number;

            /** The contact's business profile work hours*/
            businessHours: BusinessHours;

            /** The contact's business profile address */
            address: string;

            /** The contact's business profile facebook page */
            fbPage: object;

            /** Indicate if the contact's business profile linked */
            ifProfileLinked: boolean;

            /** The contact's business profile coverPhoto */
            coverPhoto: null | any;
        };
    }

    export interface PrivateContact extends Contact {}

    /**
     * Represents a Chat on WhatsApp
     *
     * @example
     * {
     *   id: {
     *     server: 'c.us',
     *     user: '554199999999',
     *     _serialized: `554199999999@c.us`
     *   },
     *   name: '+55 41 9999-9999',
     *   isGroup: false,
     *   isReadOnly: false,
     *   unreadCount: 6,
     *   timestamp: 1591484087,
     *   archived: false
     * }
     */
    export interface Chat {
        /** Indicates if the Chat is archived */
        archived: boolean;
        /** ID that represents the chat */
        id: ChatId;
        /** Indicates if the Chat is a Group Chat */
        isGroup: boolean;
        /** Indicates if the Chat is readonly */
        isReadOnly: boolean;
        /** Indicates if the Chat is muted */
        isMuted: boolean;
        /** Unix timestamp for when the mute expires */
        muteExpiration: number;
        /** Title of the chat */
        name: string;
        /** Unix timestamp for when the last activity occurred */
        timestamp: number;
        /** Amount of messages unread */
        unreadCount: number;
        /** Last message of chat */
        lastMessage: Message;
        /** Indicates if the Chat is pinned */
        pinned: boolean;
        /** Indicates if the Chat is locked */
        isLocked: boolean;

        /** Archives this chat */
        archive: () => Promise<void>;
        /** Pins this chat and returns its new Pin state */
        pin: () => Promise<boolean>;
        /** Unpins this chat and returns its new Pin state */
        unpin: () => Promise<boolean>;
        /** Clears all messages from the chat */
        clearMessages: () => Promise<boolean>;
        /** Stops typing or recording in chat immediately. */
        clearState: () => Promise<boolean>;
        /** Deletes the chat */
        delete: () => Promise<boolean>;
        /** Loads chat messages, sorted from earliest to latest. */
        fetchMessages: (
            searchOptions: MessageSearchOptions,
        ) => Promise<Message[]>;
        /** Mutes this chat forever, unless a date is specified */
        mute: (
            unmuteDate?: Date,
        ) => Promise<{ isMuted: boolean; muteExpiration: number }>;
        /** Send a message to this chat */
        sendMessage: (
            content: MessageContent,
            options?: MessageSendOptions,
        ) => Promise<Message>;
        /** Sets the chat as seen */
        sendSeen: () => Promise<boolean>;
        /** Simulate recording audio in chat. This will last for 25 seconds */
        sendStateRecording: () => Promise<void>;
        /** Simulate typing in chat. This will last for 25 seconds. */
        sendStateTyping: () => Promise<void>;
        /** un-archives this chat */
        unarchive: () => Promise<void>;
        /** Unmutes this chat */
        unmute: () => Promise<{ isMuted: boolean; muteExpiration: number }>;
        /** Returns the Contact that corresponds to this Chat. */
        getContact: () => Promise<Contact>;
        /** Marks this Chat as unread */
        markUnread: () => Promise<void>;
        /** Returns array of all Labels assigned to this Chat */
        getLabels: () => Promise<Label[]>;
        /** Add or remove labels to this Chat */
        changeLabels: (labelIds: Array<string | number>) => Promise<void>;
        /** Gets instances of all pinned messages in a chat */
        getPinnedMessages: () => Promise<[Message] | []>;
        /** Sync history conversation of the Chat */
        syncHistory: () => Promise<boolean>;
        /** Add or edit a customer note */
        addOrEditCustomerNote: (note: string) => Promise<void>;
        /** Get a customer note */
        getCustomerNote: () => Promise<{
            chatId: string;
            content: string;
            createdAt: number;
            id: string;
            modifiedAt: number;
            type: string;
        }>;
    }

    export interface Channel {
        /** ID that represents the channel */
        id: {
            server: string;
            user: string;
            _serialized: string;
        };
        /** Title of the channel */
        name: string;
        /** The channel description */
        description: string;
        /** Indicates if it is a Channel */
        isChannel: boolean;
        /** Indicates if it is a Group */
        isGroup: boolean;
        /** Indicates if the channel is readonly */
        isReadOnly: boolean;
        /** Amount of messages unread */
        unreadCount: number;
        /** Unix timestamp for when the last activity occurred */
        timestamp: number;
        /** Indicates if the channel is muted or not */
        isMuted: boolean;
        /** Unix timestamp for when the mute expires */
        muteExpiration: number;
        /** Last message in the channel */
        lastMessage: Message | undefined;

        /** Gets the subscribers of the channel (only those who are in your contact list) */
        getSubscribers(
            limit?: number,
        ): Promise<{ contact: Contact; role: string }[]>;
        /** Updates the channel subject */
        setSubject(newSubject: string): Promise<boolean>;
        /** Updates the channel description */
        setDescription(newDescription: string): Promise<boolean>;
        /** Updates the channel profile picture */
        setProfilePicture(newProfilePicture: MessageMedia): Promise<boolean>;
        /**
         * Updates available reactions to use in the channel
         *
         * Valid values for passing to the method are:
         * 0 for NONE reactions to be avaliable
         * 1 for BASIC reactions to be available: 👍, ❤️, 😂, 😮, 😢, 🙏
         * 2 for ALL reactions to be available
         */
        setReactionSetting(reactionCode: number): Promise<boolean>;
        /** Mutes the channel */
        mute(): Promise<boolean>;
        /** Unmutes the channel */
        unmute(): Promise<boolean>;
        /** Sends a message to this channel */
        sendMessage(
            content: string | MessageMedia,
            options?: MessageSendChannelOptions,
        ): Promise<Message>;
        /** Sets the channel as seen */
        sendSeen(): Promise<boolean>;
        /** Sends a channel admin invitation to a user, allowing them to become an admin of the channel */
        sendChannelAdminInvite(
            chatId: string,
            options?: { comment?: string },
        ): Promise<boolean>;
        /** Accepts a channel admin invitation and promotes the current user to a channel admin */
        acceptChannelAdminInvite(): Promise<boolean>;
        /** Revokes a channel admin invitation sent to a user by a channel owner */
        revokeChannelAdminInvite(userId: string): Promise<boolean>;
        /** Demotes a channel admin to a regular subscriber (can be used also for self-demotion) */
        demoteChannelAdmin(userId: string): Promise<boolean>;
        /** Loads channel messages, sorted from earliest to latest */
        fetchMessages: (
            searchOptions: MessageSearchOptions,
        ) => Promise<Message[]>;
        /**
         * Transfers a channel ownership to another user.
         * Note: the user you are transferring the channel ownership to must be a channel admin.
         */
        transferChannelOwnership(
            newOwnerId: string,
            options?: TransferChannelOwnershipOptions,
        ): Promise<boolean>;
        /** Deletes the channel you created */
        deleteChannel(): Promise<boolean>;
    }

    /** Options for transferring a channel ownership to another user */
    export interface TransferChannelOwnershipOptions {
        /**
         * If true, after the channel ownership is being transferred to another user,
         * the current user will be dismissed as a channel admin and will become to a channel subscriber.
         */
        shouldDismissSelfAsAdmin?: boolean;
    }

    /** Options for sending a message */
    export interface MessageSendChannelOptions {
        /** Image or videos caption */
        caption?: string;
        /** User IDs of user that will be mentioned in the message */
        mentions?: string[];
        /** Image or video to be sent */
        media?: MessageMedia;
        /** Extra options */
        extra?: any;
    }

    export interface MessageSearchOptions {
        /**
         * The amount of messages to return. If no limit is specified, the available messages will be returned.
         * Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation.
         * Set this to Infinity to load all messages.
         */
        limit?: number;
        /**
         * Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.
         */
        fromMe?: boolean;
    }

    /**
     * Id that represents the chat
     *
     * @example
     * id: {
     *   server: 'c.us',
     *   user: '554199999999',
     *   _serialized: `554199999999@c.us`
     * },
     */
    export interface ChatId {
        /**
         * Whatsapp server domain
         * @example `c.us`
         */
        server: string;
        /**
         * User whatsapp number
         * @example `554199999999`
         */
        user: string;
        /**
         * Serialized id
         * @example `554199999999@c.us`
         */
        _serialized: string;
    }

    export interface PrivateChat extends Chat {}

    export type GroupParticipant = {
        id: ContactId;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    };

    /** Promotes or demotes participants by IDs to regular users or admins */
    export type ChangeParticipantsPermissions = (
        participantIds: Array<string>,
    ) => Promise<{ status: number }>;

    /** An object that handles the result for addParticipants method */
    export interface AddParticipantsResult {
        [participantId: string]: {
            code: number;
            message: string;
            isInviteV4Sent: boolean;
        };
    }

    /** An object that handles options for adding participants */
    export interface AddParticipantsOptions {
        /**
         * The number of milliseconds to wait before adding the next participant.
         * If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added
         * (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100
         * will be added). If sleep is a number, a sleep time equal to its value will be added
         * @default [250,500]
         */
        sleep?: Array<number> | number;
        /**
         * If true, the inviteV4 will be sent to those participants
         * who have restricted others from being automatically added to groups,
         * otherwise the inviteV4 won't be sent
         * @default true
         */
        autoSendInviteV4?: boolean;
        /**
         * The comment to be added to an inviteV4 (empty string by default)
         * @default ''
         */
        comment?: string;
    }

    /** An object that handles the information about the group membership request */
    export interface GroupMembershipRequest {
        /** The wid of a user who requests to enter the group */
        id: Object;
        /** The wid of a user who created that request */
        addedBy: Object;
        /** The wid of a community parent group to which the current group is linked */
        parentGroupId: Object | null;
        /** The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin */
        requestMethod: string;
        /** The timestamp the request was created at */
        t: number;
    }

    /** An object that handles the result for membership request action */
    export interface MembershipRequestActionResult {
        /** User ID whos membership request was approved/rejected */
        requesterId: Array<string> | string | null;
        /** An error code that occurred during the operation for the participant */
        error?: number;
        /** A message with a result of membership request action */
        message: string;
    }

    /** Options for performing a membership request action  */
    export interface MembershipRequestActionOptions {
        /** User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group */
        requesterIds: Array<string> | string | null;
        /** The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500] */
        sleep: Array<number> | number | null;
    }

    export interface GroupChat extends Chat {
        /** Group owner */
        owner: ContactId;
        /** Date at which the group was created */
        createdAt: Date;
        /** Group description */
        description: string;
        /** Group participants */
        participants: Array<GroupParticipant>;
        /** Adds a list of participants by ID to the group */
        addParticipants: (
            participantIds: string | string[],
            options?: AddParticipantsOptions,
        ) => Promise<{ [key: string]: AddParticipantsResult } | string>;
        /** Removes a list of participants by ID to the group */
        removeParticipants: (
            participantIds: string[],
        ) => Promise<{ status: number }>;
        /** Promotes participants by IDs to admins */
        promoteParticipants: ChangeParticipantsPermissions;
        /** Demotes participants by IDs to regular users */
        demoteParticipants: ChangeParticipantsPermissions;
        /** Updates the group subject */
        setSubject: (subject: string) => Promise<boolean>;
        /** Updates the group description */
        setDescription: (description: string) => Promise<boolean>;
        /**
         * Updates the group setting to allow only admins to add members to the group.
         * @param {boolean} [adminsOnly=true] Enable or disable this option
         * @returns {Promise<boolean>} Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.
         */
        setAddMembersAdminsOnly: (adminsOnly?: boolean) => Promise<boolean>;
        /** Updates the group settings to only allow admins to send messages
         * @param {boolean} [adminsOnly=true] Enable or disable this option
         * @returns {Promise<boolean>} Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.
         */
        setMessagesAdminsOnly: (adminsOnly?: boolean) => Promise<boolean>;
        /**
         * Updates the group settings to only allow admins to edit group info (title, description, photo).
         * @param {boolean} [adminsOnly=true] Enable or disable this option
         * @returns {Promise<boolean>} Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.
         */
        setInfoAdminsOnly: (adminsOnly?: boolean) => Promise<boolean>;
        /**
         * Gets an array of membership requests
         * @returns {Promise<Array<GroupMembershipRequest>>} An array of membership requests
         */
        getGroupMembershipRequests: () => Promise<
            Array<GroupMembershipRequest>
        >;
        /**
         * Approves membership requests if any
         * @param {MembershipRequestActionOptions} options Options for performing a membership request action
         * @returns {Promise<Array<MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were approved and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
         */
        approveGroupMembershipRequests: (
            options: MembershipRequestActionOptions,
        ) => Promise<Array<MembershipRequestActionResult>>;
        /**
         * Rejects membership requests if any
         * @param {MembershipRequestActionOptions} options Options for performing a membership request action
         * @returns {Promise<Array<MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were rejected and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
         */
        rejectGroupMembershipRequests: (
            options: MembershipRequestActionOptions,
        ) => Promise<Array<MembershipRequestActionResult>>;
        /** Gets the invite code for a specific group */
        getInviteCode: () => Promise<string>;
        /** Invalidates the current group invite code and generates a new one */
        revokeInvite: () => Promise<void>;
        /** Makes the bot leave the group */
        leave: () => Promise<void>;
        /** Sets the group's picture.*/
        setPicture: (media: MessageMedia) => Promise<boolean>;
        /** Deletes the group's picture */
        deletePicture: () => Promise<boolean>;
    }

    /**
     * Represents the metadata associated with a given product
     *
     */
    export interface ProductMetadata {
        /** Product Id */
        id: string;
        /** Product Name */
        name: string;
        /** Product Description */
        description: string;
        /** Retailer ID */
        retailer_id?: string;
    }

    /**
     * Represents a Product on Whatsapp
     * @example
     * {
     * "id": "123456789",
     * "price": "150000",
     * "thumbnailId": "123456789",
     * "thumbnailUrl": "https://mmg.whatsapp.net",
     * "currency": "GTQ",
     * "name": "Store Name",
     * "quantity": 1
     * }
     */
    export interface Product {
        /** Product Id */
        id: string;
        /** Price */
        price?: string;
        /** Product Thumbnail*/
        thumbnailUrl: string;
        /** Currency */
        currency: string;
        /** Product Name */
        name: string;
        /** Product Quantity*/
        quantity: number;
        /** Gets the Product metadata */
        getData: () => Promise<ProductMetadata>;
    }

    /**
     * Represents a Order on WhatsApp
     *
     * @example
     * {
     * "products": [
     * {
     * "id": "123456789",
     * "price": "150000",
     * "thumbnailId": "123456789",
     * "thumbnailUrl": "https://mmg.whatsapp.net",
     * "currency": "GTQ",
     * "name": "Store Name",
     * "quantity": 1
     * }
     * ],
     * "subtotal": "150000",
     * "total": "150000",
     * "currency": "GTQ",
     * "createdAt": 1610136796,
     * "sellerJid": "55555555@s.whatsapp.net"
     * }
     */
    export interface Order {
        /** List of products*/
        products: Array<Product>;
        /** Order Subtotal */
        subtotal: string;
        /** Order Total */
        total: string;
        /** Order Currency */
        currency: string;
        /** Order Created At*/
        createdAt: number;
    }

    /**
     * Represents a Payment on WhatsApp
     *
     * @example
     * {
     * id: {
     * fromMe: true,
     * remote: {
     * server: 'c.us',
     * user: '5511999999999',
     * _serialized: '5511999999999@c.us'
     * },
     *  id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
     * _serialized: 'true_5511999999999@c.us_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
     * },
     * paymentCurrency: 'BRL',
     * paymentAmount1000: 1000,
     * paymentMessageReceiverJid: {
     * server: 'c.us',
     * user: '5511999999999',
     * _serialized: '5511999999999@c.us'
     * },
     * paymentTransactionTimestamp: 1623463058,
     * paymentStatus: 4,
     * paymentTxnStatus: 4,
     * paymentNote: 'note'
     * }
     */
    export interface Payment {
        /** Payment Id*/
        id: object;
        /** Payment currency */
        paymentCurrency: string;
        /** Payment ammount  */
        paymentAmount1000: number;
        /** Payment receiver */
        paymentMessageReceiverJid: object;
        /** Payment transaction timestamp */
        paymentTransactionTimestamp: number;
        /** Payment paymentStatus */
        paymentStatus: number;
        /** Integer that represents the payment Text */
        paymentTxnStatus: number;
        /** The note sent with the payment */
        paymentNote: string;
    }

    /**
     * Represents a Call on WhatsApp
     *
     * @example
     * Call {
     * id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
     * from: '5511999999@c.us',
     * timestamp: 1625003709,
     * isVideo: false,
     * isGroup: false,
     * fromMe: false,
     * canHandleLocally: false,
     * webClientShouldHandle: false,
     * participants: []
     * }
     */
    export interface Call {
        /** Call Id */
        id: string;
        /** from */
        from?: string;
        /** Unix timestamp for when the call was created*/
        timestamp: number;
        /** Is video */
        isVideo: boolean;
        /** Is Group */
        isGroup: boolean;
        /** Indicates if the call was sent by the current user */
        fromMe: boolean;
        /** indicates if the call can be handled in waweb */
        canHandleLocally: boolean;
        /** indicates if the call should be handled in waweb */
        webClientShouldHandle: boolean;
        /** Object with participants */
        participants: object;

        /** Reject the call */
        reject: () => Promise<void>;
    }

    /** Message type List */
    export class List {
        body: string;
        buttonText: string;
        sections: Array<any>;
        title?: string | null;
        footer?: string | null;

        constructor(
            body: string,
            buttonText: string,
            sections: Array<any>,
            title?: string | null,
            footer?: string | null,
        );
    }

    /** Message type Buttons */
    export class Buttons {
        body: string | MessageMedia;
        buttons: Array<{
            buttonId: string;
            buttonText: { displayText: string };
            type: number;
        }>;
        title?: string | null;
        footer?: string | null;

        constructor(
            body: string,
            buttons: Array<{ id?: string; body: string }>,
            title?: string | null,
            footer?: string | null,
        );
    }

    /** Message type Reaction */
    export class Reaction {
        id: MessageId;
        orphan: number;
        orphanReason?: string;
        timestamp: number;
        reaction: string;
        read: boolean;
        msgId: MessageId;
        senderId: string;
        ack?: number;
    }

    export type ReactionList = {
        id: string;
        aggregateEmoji: string;
        hasReactionByMe: boolean;
        senders: Array<Reaction>;
    };
}

export = WAWebJS;
