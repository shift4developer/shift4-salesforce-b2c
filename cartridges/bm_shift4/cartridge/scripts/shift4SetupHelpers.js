'use strict';

/**
 * @description Test the integrations outbound connection
 * @param {boolean} isLiveMode Whether to test the live mode or test mode keys
 * @returns {ResponseData} Whether the keys are valid
 */
module.exports.testOutboundConnection = function (isLiveMode) {
    var ResponseData = require('*/cartridge/models/shift4/responseData');
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var responseData = new ResponseData();

    var mode = isLiveMode ? 'live' : 'test';
    var hasSecretKey = !!SitePreferences.custom['shift4payments__' + mode + 'SecretKey'];
    var hasPublicKey = !!SitePreferences.custom['shift4payments__' + mode + 'PublicKey'];
    if (!hasSecretKey || !hasPublicKey) {
        responseData.results.isConnected = false;
        responseData.addError(
            'The ' + mode + ' mode credentials are missing. The integration is currently disconnected.'
        );
        return responseData;
    }

    var Shift4Api = require('*/cartridge/scripts/shift4/services/shift4API');

    var secretKeyIsValid = true;
    try {
        Shift4Api.verifySecretKey(isLiveMode);
    } catch (ignored) {
        secretKeyIsValid = false;
    }

    var publicKeyIsValid = true;
    try {
        Shift4Api.verifyPublicKey(isLiveMode);
    } catch (ignored) {
        publicKeyIsValid = false;
    }

    if (secretKeyIsValid && publicKeyIsValid) {
        responseData.results.isConnected = true;
        return responseData;
    }

    if (!secretKeyIsValid) {
        responseData.addFieldError(
            'shift4payments__' + mode + 'SecretKey',
            'This ' + mode + ' mode secret key is invalid'
        );
    }

    if (!publicKeyIsValid) {
        responseData.addFieldError(
            'shift4payments__' + mode + 'PublicKey',
            'This ' + mode + ' mode public key is invalid'
        );
    }

    responseData.results.isConnected = false;
    var invalidKeyString = secretKeyIsValid ? 'public key is' : publicKeyIsValid ? 'keys are' : 'secret key is';
    responseData.addError(
        'The ' + mode + ' mode ' + invalidKeyString + ' invalid. The integration is currently disconnected.'
    );
    return responseData;
};

/**
 * @typedef {Object} PaymentProcessorState
 * @property {Array<string>} disabledPaymentMethods
 * @property {boolean} isEnabled
 */

/**
 * @description Check the status of the shift4 payment processors and whether the merchant has enabled any
 * @returns {PaymentProcessorState} Status of the shift4 payement processors
 */
module.exports.getPaymentProcessorState = function () {
    var Constants = require('*/cartridge/constants/shift4Constants');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var disabledPaymentMethods = [];
    var isEnabled = false;
    Object.keys(Constants.PAYMENT_PROCESSOR_SUPPORT).forEach(function (paymentProcessorID) {
        Constants.PAYMENT_PROCESSOR_SUPPORT[paymentProcessorID].forEach(function (paymentMethodID) {
            var paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodID);
            if (!paymentMethod || !paymentMethod.active) {
                // Merchant isn't using this payment method
                return;
            }
            // If the merchant is using shift4 as the provider for this method, the status is true, else it is false
            if (paymentMethod.paymentProcessor.ID === paymentProcessorID) {
                isEnabled = true;
            } else {
                disabledPaymentMethods.push(paymentMethod.name);
            }
        });
    });
    return {
        disabledPaymentMethods: disabledPaymentMethods,
        isEnabled: isEnabled
    };
};

/**
 * @description Get a warning message about the disabled payment methods
 * @param {Array<string>} disabledPaymentMethods Disabled payment methods
 * @returns {string} Warning message with link to Payment Methods setup page
 */
module.exports.getDisabledPaymentMethodsWarning = function (disabledPaymentMethods) {
    var URLUtils = require('dw/web/URLUtils');
    var Resource = require('dw/web/Resource');
    return Resource.msgf(
        'warning.payment.methods.disabled',
        'bm_shift4',
        null,
        disabledPaymentMethods.join(', '),
        URLUtils.url('PaymentMethod-Start').toString()
    );
};
