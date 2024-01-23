'use strict';
/* MOCK */

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

class MockResult {
    statusCode = 0;
    ok = false;
    object = null;
    errorMessage = null;
    error = null;
    msg = null;
    constructor(statusCode, body) {
        this.statusCode = statusCode;
        this.ok = statusCode >= 200 && statusCode < 300;
        this.object = body;
        if (!this.ok) {
            this.error = statusCode;
            this.msg = JSON.stringify(body);
            this.errorMessage = JSON.stringify(body);
        }
    }
}

/**
 * -----------------------------
 * ANONYMOUS MOCK HANDLERS
 * -----------------------------
 */

const ERROR_405 = new MockResult(405, {
    error: {
        message: 'Method not allowed'
    }
});

/**
 * @param {MockService} service
 * @param {CalloutRequest} request
 */
function handleCustomerRequest(service, request) {
    // Add / Remove cards from customer
    if (request.endpoint.includes('/cards')) {
        if (request.httpMethod === 'POST') {
            return new MockResult(201, {
                id: 'card_1234567890',
                ...service.payload
            });
        } else if (request.httpMethod === 'DELETE') {
            return new MockResult(200, {});
        } else {
            return ERROR_405;
        }
    }

    // Create / Update / Delete customer
    if (request.httpMethod === 'POST') {
        return new MockResult(201, {
            id: 'cust_1234567890',
            ...service.payload
        });
    } else if (request.httpMethod === 'GET') {
        return new MockResult(200, {
            id: 'cust_1234567890',
            ...service.payload
        });
    } else if (request.httpMethod === 'DELETE') {
        return new MockResult(200, {});
    } else {
        return ERROR_405;
    }
}
/**
 * @param {MockService} service
 * @param {CalloutRequest} request
 */
function handleAPMRequest(service, request) {
    if (request.httpMethod === 'POST') {
        return new MockResult(201, {
            id: 'pm_1234567890',
            ...service.payload
        });
    } else {
        return ERROR_405;
    }
}
/**
 * @param {MockService} service
 * @param {CalloutRequest} request
 */
function handleTokenRequest(service, request) {
    if (request.httpMethod === 'POST') {
        return new MockResult(201, {
            id: 'tok_1234567890',
            ...service.payload
        });
    } else {
        return ERROR_405;
    }
}
/**
 * @param {MockService} service
 * @param {CalloutRequest} request
 */
function handleChargeRequest(service, request) {
    if (request.httpMethod === 'POST') {
        return new MockResult(201, {
            id: 'char_1234567890',
            ...service.payload
        });
    } else {
        return ERROR_405;
    }
}

/**
 * -----------------------------
 * MOCK SERVICE CLASS
 * -----------------------------
 */
class MockService {
    headers = {};
    params = {};
    payload = null;
    method = null;
    url = null;

    constructor(serviceID, serviceDefinition) {
        this.serviceID = serviceID;
        this.serviceDefinition = serviceDefinition;
    }

    get configuration() {
        return {
            credential: {
                URL: 'https://api.shift4.com'
            }
        };
    }

    /**
     * @description Call the mock service
     * @param {CalloutRequest} request
     */
    call(request) {
        this.payload = this.serviceDefinition.createRequest(this, request);

        // MOCK LOGIC
        // Authentication
        if (!this.headers.authorization) {
            return new MockResult(401, {
                error: {
                    message: 'No authorization header'
                }
            });
        }
        const token = atob(this.headers.authorization.split(' ')[1]).split(':')[0];
        if ((request.isPublic && !token.startsWith('pk_')) || (!request.isPublic && !token.startsWith('sk_'))) {
            return new MockResult(401, {
                error: {
                    message: 'Invalid authorization header'
                }
            });
        }

        // Handle specific endpoint requests
        let response;
        if (request.endpoint.startsWith('/customers')) {
            response = handleCustomerRequest(this, request);
        } else if (request.endpoint.startsWith('/payment-methods')) {
            response = handleAPMRequest(this, request);
        } else if (request.endpoint.startsWith('/tokens')) {
            response = handleTokenRequest(this, request);
        } else if (request.endpoint.startsWith('/charges')) {
            response = handleChargeRequest(this, request);
        } else {
            return new MockResult(404, {
                error: {
                    message: 'Resource not found'
                }
            });
        }

        this.serviceDefinition.parseResponse(this, { text: JSON.stringify(response.object) });
        this.serviceDefinition.filterLogMessage(JSON.stringify(response.object));
        return response;
    }

    setRequestMethod(method) {
        this.method = method;
    }
    setURL(url) {
        this.url = url;
    }
    addHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
    }
    addParam(name, value) {
        if (name.endsWith('[]')) {
            this.params[name] = this.params[name] || [];
            this.params[name].push(value);
        } else {
            this.params[name] = value;
        }
    }
}

/**
 * @description
 * @param {string} serviceID
 * @param {Object} serviceDefinition
 * @returns
 */
module.exports.createService = function (serviceID, serviceDefinition) {
    return new MockService(serviceID, serviceDefinition);
};
