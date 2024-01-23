'use strict';

/**
 * @description Error wrapper for callout failures.
 * @class
 */
class CalloutError extends Error {
    /**
     * @constructor
     * @description The server was unable to handle an error,
     * @param {number} status - HTTP Status Code
     * @param {string} responseText - Response from server
     */
    constructor(status, responseText) {
        try {
            const responseData = JSON.parse(responseText);
            super(responseData.error ?? 'Something went wrong communicating with the server. Please try again later.');
            this.stack = responseData.stack;
        } catch (ignored) {
            super(responseText);
        }
        this.status = status;
    }
}

const utils = Object.freeze({
    /**
     * @description Make an http callout
     * @param {string} method HTTP Request method
     * @param {string} url URL of the request
     * @param {any} data Data to send in the request
     * @returns {Promise<string, CalloutError>} Resolves either the response body as a string rejects with a callout error
     */
    callout: async function (method, url, data) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 400) {
                        reject(new CalloutError(xhr.status, xhr.responseText));
                    } else {
                        resolve(xhr.responseText);
                    }
                }
            };
            if (data) {
                if (typeof data !== 'string') {
                    data = JSON.stringify(data);
                }
                xhr.send(data);
            } else {
                xhr.send();
            }
        });
    },

    /**
     * @description Make a GET request to a URL
     * @param {string} url - URL to hit
     * @returns {Promise<string, CalloutError>} Resolves either the response body as a string rejects with a callout error
     */
    get: async function (url) {
        return this.callout('GET', url);
    },

    /**
     * @description Make a GET request to a URL
     * @param {string} url - URL to hit
     * @param {any} data - Data to send in the request
     * @returns {Promise<string, CalloutError>} Resolves either the response body as a string rejects with a callout error
     */
    post: async function (url, data) {
        return this.callout('POST', url, data);
    },

    /**
     * @description Check if a response is successful. If so, return the results. If not, throw the error
     * @param {string} rd - JSON string response data from controller
     */
    handleResponseData: function (rd) {
        /** @type {ResponseData} */
        const responseData = JSON.parse(rd);
        if (responseData.isSuccess) {
            return responseData.results;
        }
        throw responseData;
    },

    /**
     * @description Parse the error out of a
     * @param {any} error
     */
    getErrorMessage(error) {
        if (!error) {
            return 'Something went wrong.';
        }
        if (typeof error === 'string') {
            return error;
        }
        if (Array.isArray(error)) {
            return error.map((e) => this.getErrorMessage(e)).join(' - ');
        }
        return error.error ?? error.message ?? 'Something went wrong.';
    }
});
