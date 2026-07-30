'use strict';

const Base = require('./Base');

/**
 * Current connection information
 * @extends {Base}
 */
class ClientInfo extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * Name configured to be shown in push notifications
         * @type {string}
         */
        this.pushname = data.pushname;

        /**
         * Current user ID
         * @type {object}
         */
        this.wid = Base._normalizeId(data.wid);

        /**
         * @type {object}
         * @deprecated Use .wid instead
         */
        this.me = data.wid;

        /**
         * Information about the phone this client is connected to. Not available in multi-device.
         * @type {object}
         * @property {string} wa_version WhatsApp Version running on the phone
         * @property {string} os_version OS Version running on the phone (iOS or Android version)
         * @property {string} device_manufacturer Device manufacturer
         * @property {string} device_model Device model
         * @property {string} os_build_number OS build number
         * @deprecated
         */
        this.phone = data.phone;

        /**
         * Platform WhatsApp is running on
         * @type {string}
         */
        this.platform = data.platform;

        return super._patch(data);
    }

    /**
     * Get current battery percentage and charging status for the attached device
     * @returns {object} batteryStatus
     * @returns {number} batteryStatus.battery - The current battery percentage
     * @returns {boolean} batteryStatus.plugged - Indicates if the phone is plugged in (true) or not (false)
     * @deprecated
     */
    async getBatteryStatus() {
        return await this.client.pupPage.evaluate(() => {
            const { battery, plugged } = window.require('WAWebConnModel').Conn;
            return { battery, plugged };
        });
    }
}

module.exports = ClientInfo;
