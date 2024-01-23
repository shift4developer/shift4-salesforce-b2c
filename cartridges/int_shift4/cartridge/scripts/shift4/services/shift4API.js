'use strict';

/**
 * ----------------------------------------------
 *               TYPE DEFINITONS
 * ----------------------------------------------
 */

/**
 * @typedef {('GET' | 'POST' | 'PUT' | 'DELETE')} HTTPMethod
 */

/**
 * @typedef {object} CalloutRequest
 * @property {HTTPMethod} httpMethod - Http Method
 * @property {string} endpoint - Path after domain
 * @property {object?} [query] - (optional) Query parameters to apply to the uri
 * @property {any?} [payload] - (optional) Request body
 * @property {boolean} [liveMode] - (optional) specify whether to use live mode or test mode. If not specified, the value from SitePreferences. shift4payments__environment will be used
 * @property {boolean} [isPublic] - (optional) specify whether to use the public key for authentication instead of the secret key
 * @property {boolean} [isRetry] - (optional) specify whether this is a retry attempt
 */

/**
 * @typedef {object} Shift4CardRequest
 * @property {string} number
 * @property {string} expMonth
 * @property {string} expYear
 * @property {string} cvc
 * @property {string} cardholderName
 * @property {string} addressLine1
 * @property {string} addressLine2
 * @property {string} addressState
 * @property {string} addressZip
 * @property {string} addressCountry
 * @property {object} fraudCheckData
 * @property {string} fraudCheckData.ipAddress
 * @property {string} fraudCheckData.ipCountry
 * @property {string} fraudCheckData.email
 * @property {string} fraudCheckData.userAgent
 * @property {string} fraudCheckData.acceptLanguage
 * @property {string} fraudCheckData.browserFingerprint
 */

/**
 * @typedef {object} Shift4CustomerRequest
 * @property {string} email
 * @property {Shift4CardRequest | string | undefined} [card]
 * @property {string?} [description]
 * @property {object?} [metadata]
 */

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

/**
 * ----------------------------------------------
 *               SERVICE DEFINITION
 * ----------------------------------------------
 */

var shift4Service = LocalServiceRegistry.createService('Shift4', {
    /**
     * @description Apply the request object to the service reference
     * @param {dw.svc.HTTPService} service Service instance
     * @param {CalloutRequest} request - Http callout request
     * @returns {string | null} - The body of HTTP request
     */
    createRequest: function (service, request) {
        // Authentication
        var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
        var Encoding = require('dw/crypto/Encoding');
        var Bytes = require('dw/util/Bytes');
        var useLiveMode = typeof request.liveMode === 'boolean' ? request.liveMode : SitePreferences.isLiveMode();
        var key;
        if (!!request.isPublic) {
            key = useLiveMode
                ? SitePreferences.custom.shift4payments__livePublicKey
                : SitePreferences.custom.shift4payments__testPublicKey;
        } else {
            key = useLiveMode
                ? SitePreferences.custom.shift4payments__liveSecretKey
                : SitePreferences.custom.shift4payments__testSecretKey;
        }
        service.addHeader('Authorization', 'Basic ' + Encoding.toBase64(new Bytes(key + ':')));

        // HTTP Method
        if (request.httpMethod) {
            service.setRequestMethod(request.httpMethod);
        } else {
            service.setRequestMethod('GET');
        }

        // Build URL
        service.setURL(service.configuration.credential.URL + request.endpoint);
        if (request.query) {
            Object.keys(request.query).forEach(function (parameter) {
                service.addParam(parameter, request.query[parameter]);
            });
        }

        // For requests with no payload, return null
        if (!request.payload) {
            return null;
        }

        // All Shift4 request payloads are application/json
        service.addHeader('Content-Type', 'application/json');

        // Return the payload (stringify as necessary)
        if (typeof request.payload !== 'string') {
            return JSON.stringify(request.payload);
        }
        return request.payload;
    },

    /**
     * @description A callback function to parse Shift4 API Response
     * @param {dw.svc.Service} service - Service instance
     * @param {dw.net.HTTPClient} httpClient - HTTP client instance
     * @returns {string} - Response body in case of a successful request or null
     */
    parseResponse: function (service, httpClient) {
        return JSON.parse(httpClient.text);
    },

    /**
     * @description A callback that allows filtering communication URL, request, and response log messages. Must be implemented to have messages logged on Production.
     * @param {string} msg - The original message to log.
     * @returns {string} - The message, with secret fields masked.
     */
    filterLogMessage: function (msg) {
        try {
            var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
            return JSON.stringify(CardHelpers.maskCardDetails(JSON.parse(msg)));
        } catch (ignored) {
            return msg;
        }
    }

    /**
     * Other Methods to override in this service definition can be found here:
     * https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/upcoming/scriptapi/html/index.html?target=class_dw_svc_ServiceCallback.html
     */
});

/**
 * ----------------------------------------------
 *               CALLOUT HELPERS
 * ----------------------------------------------
 */

/**
 * @description Make a callout to the Shift4 API
 * @param {CalloutRequest} request - The callout request details
 * @return {object} - Parsed response body
 */
function callService(request) {
    var callResult = shift4Service.call(request);

    if (!callResult.ok) {
        // If the connection was reset, retry once
        if (callResult.msg.includes('Connection Reset') && !request.isRetry) {
            return callService(Object.assign({ isRetry: true }, request));
        }
        var message = 'Shift4 API Callout failed';
        if (callResult.errorMessage) {
            try {
                var jsonMessage = JSON.parse(callResult.errorMessage);
                if (jsonMessage && jsonMessage.error && jsonMessage.error.message) {
                    message = jsonMessage.error.message;
                }
            } catch (ignored) {
                message += ': ' + callResult.errorMessage;
            }
        }

        var err = new Error(message);
        err.responseBody = callResult.errorMessage;
        err.name = 'Shift4ServiceError';
        throw err;
    }

    return callResult.object;
}

/**
 * @description Perform a POST request to the Shift4 API
 * @param {string} endpoint - Endpoint to the resource to fetch
 * @param {object?} [query] - Optional query parameters
 * @return {object} - Result returned by the callout
 */
function get(endpoint, query) {
    return callService({
        httpMethod: 'GET',
        endpoint: endpoint,
        query: query
    });
}

/**
 * @description Perform a POST request to the Shift4 API
 * @param {string} endpoint - Endpoint to the resource to post to
 * @param {object | string | undefined} payload - Request body
 * @return {object} - Result returned by the callout
 */
function post(endpoint, payload) {
    return callService({
        httpMethod: 'POST',
        endpoint: endpoint,
        payload: payload
    });
}

/**
 * @description Perform a DELETE Request to the Shift4 API
 * @param {string} endpoint - Endpoint to the resource to delete
 * @return {object} - Result returned by the callout
 */
function delete_x(endpoint) {
    return callService({
        httpMethod: 'DELETE',
        endpoint: endpoint
    });
}

/**
 * ----------------------------------------------
 *                 API EXPORTS
 * ----------------------------------------------
 */

// https://dev.shift4.com/docs/api#customers
module.exports.customer = {
    /**
     * @description Create a new Shift4 customer
     * @param {Shift4CustomerRequest} customerInfo - Customer information
     * @return {object} - New Customer record
     */
    create: function (customerInfo) {
        return post('/customers', customerInfo);
    },
    /**
     * @description Get a customer by ID
     * @param {string} customerId - Customer ID
     * @return {object} - Customer record
     */
    get: function (customerId) {
        return get('/customers/' + customerId);
    },
    /**
     * @description Update an existing Shift4 Customer
     * @param {string} customerId - Customer ID
     * @param {Shift4CustomerRequest} customerInfo - Customer Information to update
     * @return {object} - Updated customer record
     */
    update: function (customerId, customerInfo) {
        return post('/customers/' + customerId, customerInfo);
    },
    /**
     * @description Delete a customer
     * @param {string} customerId - Id of the customer to delete
     * @return {object | null} - Delete result
     */
    delete: function (customerId) {
        return delete_x('/customers/' + customerId);
    },
    /**
     * @description List customers
     * @param {string?} [email] - Query for only customers with this email
     * @param {number?} [limit] - Max number of customers to list
     * @return {object} - List of customers
     */
    list: function (email, limit) {
        return get('/customers', {
            email: email,
            limit: limit
        });
    },
    /**
     * Control the cards for a specific customer
     */
    cards: {
        /**
         * @description Add a card to a customer's shift4 profile
         * @param {string} customerId Customer ID
         * @param {Object | string} payload New Card payload
         * @returns {Object} New Card Details
         */
        add: function (customerId, payload) {
            return post('/customers/' + customerId + '/cards', payload);
        },
        /**
         * @description Delete a card from a shift4 customer's profile
         * @param {string} customerId Shift4 Customer ID
         * @param {string} cardId Shift4 Card ID
         */
        remove: function (customerId, cardId) {
            delete_x('/customers/' + customerId + '/cards/' + cardId);
        }
    }
};

module.exports.apm = {
    /**
     * @description Create a payment method in Shift4
     * @param {Object} payload Payment method payload
     * @returns {Object} Payment method response
     */
    create: function (payload) {
        return post('/payment-methods', payload);
    }
};

// https://dev.shift4.com/docs/api#tokens
module.exports.token = {
    /**
     * @description Tokenize a payment method
     * @param {Object} payload Token request payload
     * @returns {Object} The token response
     * @throws {Error} If the request fails
     */
    create: function (payload) {
        return post('/tokens', payload);
    }
};

// https://dev.shift4.com/docs/api#charges
module.exports.charge = {
    /**
     * @description Create a charge in Shift4
     * @param {Object} payload The charge payload to send to Shift4
     * @returns {Object} Charge object
     */
    create: function (payload) {
        return post('/charges', payload);
    }
};

/**
 * ----------------------------------------------
 *              KEY VERIFICATION
 * ----------------------------------------------
 */

/**
 * @description Make an arbitrary callout to Shift4 to verify that the public key for the selected environment is valid
 *      (the api key is taken from SitePreferences)
 * @param {boolean} liveMode - Whether to use the live mode public key or test mode public key
 * @throws {Error} If request fails
 */
module.exports.verifyPublicKey = function (liveMode) {
    var callResult = shift4Service.call({
        httpMethod: 'POST',
        endpoint: '/tokens',
        payload: {},
        liveMode: liveMode,
        isPublic: true
    });
    if (callResult.error === 401 || callResult.error === 403) {
        throw new Error('Invalid public key');
    }
};

/**
 * @description Make an arbitrary callout to Shift4 to verify that the api key for the selected environment is valid
 *      (the api key is taken from SitePreferences)
 * @param {boolean} liveMode - Whether to use the live mode secret key or test mode secret key
 * @throws {Error} If request fails
 */
module.exports.verifySecretKey = function (liveMode) {
    callService({
        liveMode: liveMode,
        httpMethod: 'GET',
        endpoint: '/customers',
        query: {
            email: '',
            limit: 1
        }
    });
};
