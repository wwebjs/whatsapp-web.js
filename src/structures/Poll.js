'use strict';

/**
 * Poll send options
 * @typedef {Object} PollSendOptions
 * @property {boolean} [allowMultipleAnswers=false] If false it is a single choice poll, otherwise it is a multiple choice poll (false by default)
 * @property {boolean} [hideVoterNames=false] If true, voter names are hidden and only the vote counts are shown (anonymous poll). Only has an effect in group chats
 * @property {?Array<number>} messageSecret The custom message secret, can be used as a poll ID. NOTE: it has to be a unique vector with a length of 32
 */

/** Represents a Poll on WhatsApp */
class Poll {
    /**
     * @param {string} pollName
     * @param {Array<string>} pollOptions
     * @param {PollSendOptions} options
     */
    constructor(pollName, pollOptions, options = {}) {
        /**
         * The name of the poll
         * @type {string}
         */
        this.pollName = pollName.trim();

        /**
         * The array of poll options
         * @type {Array.<{name: string, localId: number}>}
         */
        this.pollOptions = pollOptions.map((option, index) => ({
            name: option.trim(),
            localId: index,
        }));

        /**
         * The send options for the poll
         * @type {PollSendOptions}
         */
        this.options = {
            allowMultipleAnswers: options.allowMultipleAnswers === true,
            hideVoterNames: options.hideVoterNames === true,
            messageSecret: options.messageSecret,
        };
    }
}

module.exports = Poll;
