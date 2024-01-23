'use strict';

/**
 * @typedef {Object} ApplePayAddress
 * @property {string} country The billing contact country
 * @property {string} countryCode The billing contact country code
 * @property {string} subLocality The billing contact sub locality
 * @property {string} familyName The billing contact last name
 * @property {string} givenName The billing contact first name
 * @property {string} postalCode The billing contact postal code
 * @property {string} locality The billing contact locality
 * @property {string} subAdministrativeArea The billing sub administrative area
 * @property {string[]} addressLines The billing contact address lines
 * @property {string} administrativeArea The billing administrative area
 */

/**
 * @typedef {Object} ShippingAddressProperties
 * @property {string} emailAddress The shipping contact email address
 * @property {string} phoneNumber The shipping contact phone number
 * @typedef {ApplePayAddress & ShippingAddressProperties} ApplePayShippingAddress
 */

/**
 * @typedef {Object} ApplePayAuthorizationEvent
 * @property {boolean} isTrusted Whether the event is trusted
 * @property {object} payment The payment object
 * @property {Object} payment.token The payment token data
 * @property {string} payment.token.transactionIdentifier ApplePay Transaction ID
 * @property {Object} payment.token.paymentData The payment data
 * @property {string} payment.token.paymentData.data The encrypted payment token
 * @property {string} payment.token.paymentData.signature The signature of the token
 * @property {string} payment.token.paymentData.version The version of the token
 * @property {Object} payment.token.paymentData.header The header of the token
 * @property {string} payment.token.paymentData.header.ephemeralPublicKey The ephemeral public key
 * @property {string} payment.token.paymentData.header.publicKeyHash The public key hash
 * @property {string} payment.token.paymentData.header.transactionId The transaction ID
 * @property {Object} payment.token.paymentMethod The payment method data
 * @property {string} payment.token.paymentMethod.displayName The display name of the payment method
 * @property {string} payment.token.paymentMethod.network The payment method network
 * @property {string} payment.token.paymentMethod.type The payment method type
 * @property {ApplePayAddress} payment.billingContact The billing contact
 * @property {ApplePayShippingAddress} payment.shippingContact The shipping contact
 */

/**
 * @description Apply applicationData to the apple pay request
 * @param {dw.order.Basket} basket Current Basket
 * @param {Object} request Apple Pay Request
 * @returns {dw.extensions.applepay.ApplePayHookResult} Result of hook
 */
module.exports.getRequest = function (basket, request) {
    var ApplePayHookResult = require('dw/extensions/applepay/ApplePayHookResult');
    var Encoding = require('dw/crypto/Encoding');
    var URLUtils = require('dw/web/URLUtils');
    var Status = require('dw/system/Status');
    var Site = require('dw/system/Site');
    var Bytes = require('dw/util/Bytes');

    // Tell the front-end to use Apple Pay
    session.custom.applepaysession = 'yes';

    // Set the applicationData to the base64 encoded site domain
    var b64SiteDomain = Encoding.toBase64(new Bytes(Site.current.httpsHostName));
    request.applicationData = b64SiteDomain;

    return new ApplePayHookResult(new Status(Status.OK), URLUtils.continueURL());
};

/**
 * @description Create a charge for the given order using the token from Apple Pay
 * @param {dw.order.Order} order The order to authorize a payment for
 * @param {ApplePayAuthorizationEvent} event The ApplePay event object
 * @returns {dw.system.Status} The result status of the authorization
 */
module.exports.authorizeOrderPayment = function (order, event) {
    var Status = require('dw/system/Status');
    var Transaction = require('dw/system/Transaction');
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var Shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    var BillingHelpers = require('*/cartridge/scripts/shift4/helpers/billing');
    var paymentInstruments = order.getPaymentInstruments(PaymentInstrument.METHOD_DW_APPLE_PAY).toArray();
    var paymentInstrument = paymentInstruments.find(function (instrument) {
        return instrument.paymentTransaction !== null;
    });
    if (!paymentInstrument || !paymentInstrument.paymentTransaction) {
        return new Status(Status.ERROR);
    }
    try {
        // Create Alternative Payment Method in Shfift4
        var apmPayload = {
            type: 'apple_pay',
            applePay: {
                token: event.payment.token.paymentData
            },
            billing: {
                name: event.payment.billingContact.givenName + ' ' + event.payment.billingContact.familyName,
                email: event.payment.shippingContact.emailAddress,
                address: {
                    line1: event.payment.billingContact.addressLines.length
                        ? event.payment.billingContact.addressLines[0]
                        : null,
                    line2:
                        event.payment.billingContact.addressLines.length > 1
                            ? event.payment.billingContact.addressLines[1]
                            : null,
                    city: event.payment.billingContact.locality,
                    state: event.payment.billingContact.administrativeArea,
                    zip: event.payment.billingContact.postalCode,
                    country: event.payment.billingContact.countryCode
                }
            },
            fraudCheckData: {
                ipAddress: request.httpRemoteAddress,
                userAgent: request.httpHeaders.get('user-agent'),
                acceptLanguage: request.httpHeaders.get('accept-language'),
                email: event.payment.shippingContact.emailAddress
            }
        };
        if (customer && customer.registered && customer.profile && customer.profile.custom.shift4payments__customerId) {
            apmPayload.customerId = customer.profile.custom.shift4payments__customerId;
        }
        var applePayAPM = Shift4API.apm.create(apmPayload);

        Transaction.begin();

        // Save the Apple Pay APM ID to the payment instrument
        paymentInstrument.setCreditCardToken(applePayAPM.id);

        // If apple pay was used from the product page, the billing phone will likely be missing, so we need to populate it here
        if (order.billingAddress && !order.billingAddress.phone) {
            order.billingAddress.phone = event.payment.shippingContact.phoneNumber;
        }

        Transaction.commit();

        BillingHelpers.chargePaymentInstrument(order, paymentInstrument);
    } catch (error) {
        return new Status(Status.ERROR);
    }
    return new Status(Status.OK);
};

/**
 * @description Check if the Apple Pay verification file can be redirected to
 * @param {string | null} originEndpoint The origin endpoint
 * @returns {boolean} Whether to redirect to the Apple Pay verification file
 */
module.exports.canRedirectToApplePayVerificationFile = function (originEndpoint) {
    var Constants = require('*/cartridge/constants/shift4Constants');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var applePayPaymentMethod = PaymentMgr.getPaymentMethod('DW_APPLE_PAY');
    return !!(
        originEndpoint === Constants.ENDPOINTS.APPLE_PAY_VERIFICATION &&
        applePayPaymentMethod &&
        applePayPaymentMethod.active &&
        applePayPaymentMethod.paymentProcessor.ID === Constants.PAYMENT_PROCESSORS.SHIFT4_APM
    );
};

module.exports.fetchApplePayVerificationString = function () {
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    if (SitePreferences.custom.shift4payments__applePayVerificationString) {
        return SitePreferences.custom.shift4payments__applePayVerificationString;
    }
    var Constants = require('*/cartridge/constants/shift4Constants');
    var HTTPClient = require('dw/net/HTTPClient');
    var client = new HTTPClient();
    var url = Constants.SHIFT4_DEV_DOMAIN + Constants.ENDPOINTS.APPLE_PAY_VERIFICATION;
    client.open('GET', url);
    client.setTimeout(5000);
    client.send();
    if (client.statusCode !== 200) {
        return '';
    }
    return client.text;
};
