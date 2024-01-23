'use strict';

/**
 * @description Escape illegal JSON characters in a string
 * @param {string} str String to escape
 * @returns {string} JSON safe string
 */
function escapeJSON(str) {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

/**
 * @description Standardized class to wrap a handled server action
 * @class
 */
function ResponseData() {
    /** @type {boolean} */
    this.isSuccess = true;

    /** @type {object} */
    this.results = {};

    /** @type {string | null} */
    this.error = null;

    /** @type {Array<object>} */
    this.fieldErrors = [];

    /** @type {string | null} */
    this.stack = null;

    /**
     * @description Report an error
     * @param {any | null} [error] - The error to report
     */
    this.addError = function (error) {
        this.isSuccess = false;
        if (null == error) {
            this.error = 'An unknown error occurred';
            return;
        }
        if (typeof error === 'string') {
            error = new Error(error);
        }
        if (error instanceof Error) {
            this.error = escapeJSON(error.message);
            if (error.stack) {
                this.stack = escapeJSON(error.stack);
            }
        } else {
            this.error = error.toString();
        }
    };

    /**
     * @description Add a field-specific error to the response data
     * @param {string} fieldName Name of the field that has an error
     * @param {string} error Error message
     */
    this.addFieldError = function (fieldName, error) {
        this.isSuccess = false;
        this.fieldErrors.push({
            fieldName: fieldName,
            error: error
        });
    };

    /**
     * @description Warn the client of something
     * @param {string | null} [warning] - Any warning to display in a yellow warning banner
     */
    this.addWarning = function (warning) {
        if (warning) {
            this.results.warning = warning;
        }
    };

    /**
     * @description Add a message to this response
     * @param {string} message - Any message to send to the client
     */
    this.addMessage = function (message) {
        this.results.message = message;
    };

    /**
     * @description Apply data to this response's result
     * @param {string} key - The key to index the value by
     * @param {any?} [value] - Any value to be applied to this response's result
     */
    this.put = function (key, value) {
        this.results[key] = value;
    };

    /**
     * @description Stringify this response data instance
     * @returns {string} - JSON string of this response data
     */
    this.stringify = function () {
        return JSON.stringify(this);
    };
}

module.exports = ResponseData;
