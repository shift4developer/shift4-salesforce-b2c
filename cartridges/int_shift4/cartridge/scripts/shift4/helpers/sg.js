'use strict';
/**
 * Site Genesis helper functions
 */

/**
 * @descriptino Check if an http request object is defined in the current scope
 * @returns {boolean} Whether an http request object is defined
 */
module.exports.isRequestDefined = function () {
    return typeof request === 'object' && request && typeof request.getHttpParameterMap === 'function';
};

/**
 * @description Check if an http response object is defined in the current scope
 * @returns {boolean} - Whether an http response object is defined
 */
module.exports.isResponseDefined = function () {
    return typeof response === 'object' && response && typeof response.setStatus === 'function';
};

/**
 * @description Send a JSON response to the client
 * @param {number} statusCode - Http Status code for the response
 * @param {object | string} data - JSON object to return to the client
 */
module.exports.sendJSON = function (statusCode, data) {
    if (module.exports.isResponseDefined()) {
        response.setStatus(statusCode);
        response.setContentType('application/json');
    }
    if (typeof data !== 'string') {
        data = JSON.stringify(data);
    }
    dw.template.ISML.renderTemplate('extensions/data', { data: data });
};
