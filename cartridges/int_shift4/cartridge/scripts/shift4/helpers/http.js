'use strict';
/**
 * HTTP helper functions
 */

/**
 * @description Convert an object to a query string
 * @param {Object} payload - Payload to convert
 * @param {string | undefined} prefix - Prefix to append to parameter names. Used recursively, not needed for the intial call.
 * @returns {string} - Query string
 */
module.exports.objectToQueryString = function (payload, prefix) {
    if (typeof payload !== 'object' || !payload) {
        return '';
    }
    var queryString = '';
    Object.keys(payload).forEach(function (key) {
        var paramName = prefix && prefix.length ? prefix + '[' + (Array.isArray(payload) ? '' : key) + ']' : key;
        var paramValue = payload[key];

        if (paramValue === null || typeof paramValue === 'undefined') {
            paramValue = '';
        }

        if (paramValue && typeof paramValue === 'object') {
            queryString += module.exports.objectToQueryString(paramValue, paramName);
        } else {
            queryString += encodeURIComponent(paramName) + '=' + encodeURIComponent(paramValue);
        }
    });
    return queryString;
};
