/** @format */
'use strict';

/**
 * This is a collection of decorators for functions which performs several security checks.
 * They can be combined with each other to configure the necessary constraints for a function that is exposed to the Internet.
 *
 * @module guard
 *
 * @example
 * <caption>Example of an Account controller</caption>
 * function show() {
 *     // shows account landing page
 * }
 *
 * // allow only GET requests via HTTPS
 * exports.Show = require('~/guard').ensure(['get','https'],show);
 */
var CSRFProtection = require('dw/web/CSRFProtection');
var Resource = require('dw/web/Resource');

var ISML = require('dw/template/ISML');

/**
 * @description Performs a protocol switch for the URL of the current request to HTTPS. Responds with a redirect to the client.
 * @returns {boolean} false, if switching is not possible (for example, because its a POST request)
 */
function switchToHttps() {
    if (request.httpMethod !== 'GET') {
        // switching is not possible, send error 403 (forbidden)
        response.setStatus(403);
        return false;
    }

    var url = 'https://' + request.httpHost + request.httpPath;

    if (!empty(request.httpQueryString)) {
        url += '?' + request.httpQueryString;
    }

    response.redirect(url);
    return true;
}

/**
 * @description Render a json response with a failed csrf message
 * @returns {false} Tells the guard method that validation failed
 */
function csrfValidationFailed() {
    if (request.httpParameterMap.format.stringValue === 'ajax') {
        var SGHelpers = require('*/cartridge/scripts/shift4/helpers/sg');
        SGHelpers.sendJSON(403, {
            error: Resource.msg('global.csrf.failed.error', 'locale', null)
        });
    } else {
        ISML.renderTemplate('csrf/csrffailed');
    }

    return false;
}

/**
 * The available filters for endpoints, the names of the methods can be used in {@link module:guard~ensure}
 * @namespace
 */
var Filters = {
    /**
     * @description Action must be accessed via HTTPS
     * @returns {boolean} Whether the request is httpsecure
     */
    https: function () {
        return request.isHttpSecure();
    },
    /**
     * @description Action must be accessed via HTTP
     * @returns {boolean} Whether the request is http
     */
    http: function () {
        return !this.https();
    },
    /**
     * @description Action must be accessed via a GET request
     * @returns {boolean} Whether the http method was GET
     */
    get: function () {
        return request.httpMethod === 'GET';
    },
    /**
     * @description Action must be accessed via a POST request
     * @returns {boolean} Whether the http method was POST
     */
    post: function () {
        return request.httpMethod === 'POST';
    },
    /**
     * @description Action must only be used as remote include
     * @returns {boolean} Whether the request was a remote include
     */
    include: function () {
        // the main request will be something like kjhNd1UlX_80AgAK-0-00, all includes
        // have incremented trailing counters
        return request.httpHeaders['x-is-requestid'].indexOf('-0-00') === -1;
    },
    /**
     * @description Action must contain a valid CSRF token
     * @returns {boolean} Whether CSRF validation passed
     */
    csrf: function () {
        return CSRFProtection.validateRequest();
    }
};

/**
 * @description Deep copies all all object properties from source to target
 * @param {object} target The target object which should be extended
 * @param {object} source The object for extension
 * @return {object} Extension of source onto target
 */
function extend(target, source) {
    var _source;
    if (!target) {
        return source;
    }
    for (var i = 1; i < arguments.length; i++) {
        _source = arguments[i];
        for (var prop in _source) {
            // recurse for non-API objects
            if (_source[prop] && 'object' === typeof _source[prop] && !_source[prop].class) {
                target[prop] = extend(target[prop], _source[prop]);
            } else {
                target[prop] = _source[prop];
            }
        }
    }
    return target;
}

/**
 * @description This function should be used to secure public endpoints by applying a set of predefined filters.
 * @param {string[]} filters The filters which need to be passed to access the page
 * @param {function} action The action which represents the resource to show
 * @param {object?} [params] Additional parameters which are passed to all filters and the action
 * @returns {function} The exposed action, guarded by the provided filters
 * @see module:guard~Filters
 * @see module:guard
 */
function ensure(filters, action, params) {
    return expose(function (args) {
        var error;
        var filtersPassed = true;
        var errors = [];
        params = extend(params, args);

        for (var i = 0; i < filters.length; i++) {
            filtersPassed = Filters[filters[i]].apply(Filters);
            if (!filtersPassed) {
                errors.push(filters[i]);
                if (filters[i] === 'https') {
                    error = switchToHttps;
                } else if (filters[i] === 'csrf') {
                    error = csrfValidationFailed;
                }
                break;
            }
        }

        if (!error) {
            error = function (ignored) {
                throw new Error('Guard(s) ' + errors.join('|') + ' did not match the incoming request.');
            };
        }

        if (filtersPassed) {
            return action(params);
        } else {
            return error(params);
        }
    });
}

/**
 * @description Exposes the given action to be accessible from the web. The action gets a property which marks it as exposed. This property is checked by the platform.
 * @param {function} action A function to expose
 * @returns {function} The exposed action
 */
function expose(action) {
    action.public = true;
    return action;
}

/*
 * Module exports
 */
/** @see module:guard~expose */
exports.all = expose;

/**
 * Use this method to combine different filters, typically this is used to secure methods when exporting
 * them as publicly avaiblable endpoints in controllers.
 *
 * @example
 * // allow only GET requests for the Show endpoint
 * exports.Show = require('~/guard').ensure(['get'],show);
 *
 * // allow only POST requests via HTTPS for the Find endpoint
 * exports.Find = require('~/guard').ensure(['post','https'],find);
 */
exports.ensure = ensure;
