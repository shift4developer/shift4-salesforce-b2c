'use strict';

/**
 * @description Apply applicationData to the apple pay request
 * @param {dw.order.Basket} basket Current Basket
 * @param {Object} request Apple Pay Request
 * @returns {dw.extensions.applepay.ApplePayHookResult} Result of hook
 */
module.exports.getRequest = function (basket, request) {
    var ApplePayHelpers = require('*/cartridge/scripts/shift4/helpers/applepay');
    return ApplePayHelpers.getRequest(basket, request);
};

/**
 * @description Create a charge for the given order using the token from Apple Pay
 * @param {dw.order.Order} order The order to authorize a payment for
 * @param {Object} event The ApplePay event object
 * @returns {dw.system.Status} The result status of the authorization
 */
module.exports.authorizeOrderPayment = function (order, event) {
    var ApplePayHelpers = require('*/cartridge/scripts/shift4/helpers/applepay');
    return ApplePayHelpers.authorizeOrderPayment(order, event);
};
