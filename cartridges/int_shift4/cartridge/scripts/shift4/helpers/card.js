'use strict';

/**
 * @typedef {Object} FraudCheckData
 * @property {string?} [ipAddress]
 * @property {string?} [email]
 * @property {string?} [userAgent]
 * @property {string?} [acceptLanguage]
 */

/**
 * @typedef {Object} CardDetails
 * @property {string} number
 * @property {string | number} expMonth
 * @property {string | number} expYear
 * @property {string?} [cvc]
 * @property {string?} [cardholderName]
 * @property {string?} [addressLine1]
 * @property {string?} [addressLine2]
 * @property {string?} [addressCity]
 * @property {string?} [addressState]
 * @property {string?} [addressZip]
 * @property {string?} [addressCountry]
 * @property {FraudCheckData} [fraudCheckData]
 */

/**
 * @typedef {Object} CardVerificationResult
 * @property {dw.system.Status} status
 * @property {dw.order.PaymentCard?} [paymentCard]
 */

/**
 * @description Check if a card is valid for a payment method. Returns a status if invalid, undefined if valid.
 * @param {dw.order.PaymentMethod} paymentMethod Payment method to check
 * @param {CardDetails} card Card details to verify
 * @returns {CardVerificationResult} Result of card verification. Status is set if invalid, paymentCard is set if valid.
 */
module.exports.verify = function (paymentMethod, card) {
    var Status = require('dw/system/Status');
    var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
    var activePaymentCards = paymentMethod
        .getApplicablePaymentCards(customer, request.geolocation ? request.geolocation.countryCode : 'US', 0)
        .iterator();
    var expMonth = typeof card.expMonth === 'string' ? parseInt(card.expMonth) : card.expMonth;
    var expYear = typeof card.expYear === 'string' ? parseInt(card.expYear) : card.expYear;
    var errorStatus;
    while (activePaymentCards.hasNext()) {
        var paymentCard = activePaymentCards.next();
        /** @type {dw.system.Status} */
        var status = card.cvc
            ? paymentCard.verify(expMonth, expYear, card.number, card.cvc)
            : paymentCard.verify(expMonth, expYear, card.number);
        if (status.error) {
            errorStatus = errorStatus || status;
        } else {
            return {
                status: status,
                paymentCard: paymentCard
            };
        }
    }
    if (!errorStatus) {
        errorStatus = new Status(Status.ERROR, PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER);
    }
    return {
        status: errorStatus
    };
};

/**
 * @description Create a token in Shift4 with the provided payment information
 * @param {CardDetails} card Card details
 * @param {dw.order.Basket | null | undefined} basket Current basket
 * @returns {Object} The new token
 */
module.exports.tokenize = function (card, basket) {
    var shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    var tokenPayload = module.exports.secureCardDetails(card, basket);
    return shift4API.token.create(tokenPayload);
};

/**
 * @description Add fraud check data and order billing info to card
 * @param {CardDetails} card The card to secure
 * @param {dw.order.LineItemCtnr | null | undefined} lineItemContainer The lineItemContainer to apply billing info from
 * @returns {Object} Secured card
 */
module.exports.secureCardDetails = function (card, lineItemContainer) {
    /** @type {CardDetails} */
    var secureCard = JSON.parse(JSON.stringify(card));

    secureCard.expMonth = card.expMonth.toString();
    secureCard.expYear = card.expYear.toString();
    secureCard.fraudCheckData = {
        ipAddress: request.httpRemoteAddress,
        userAgent: request.httpHeaders.get('user-agent'),
        acceptLanguage: request.httpHeaders.get('accept-language')
    };

    if (lineItemContainer) {
        if (lineItemContainer.customerEmail) {
            secureCard.fraudCheckData.email = lineItemContainer.customerEmail;
        }
        if (lineItemContainer.billingAddress) {
            secureCard.cardholderName = lineItemContainer.billingAddress.fullName;
            secureCard.addressLine1 = lineItemContainer.billingAddress.address1;
            secureCard.addressLine2 = lineItemContainer.billingAddress.address2;
            secureCard.addressCity = lineItemContainer.billingAddress.city;
            secureCard.addressState = lineItemContainer.billingAddress.stateCode;
            secureCard.addressZip = lineItemContainer.billingAddress.postalCode;
            secureCard.addressCountry = lineItemContainer.billingAddress.countryCode.value.toUpperCase();
        }
    }

    if (customer.profile) {
        if (!secureCard.fraudCheckData.email) {
            secureCard.fraudCheckData.email = customer.profile.email;
        }
        if (!secureCard.cardholderName) {
            secureCard.cardholderName = customer.profile.firstName + ' ' + customer.profile.lastName;
        }
    }

    // Clean up to only include supported fields
    var Constants = require('*/cartridge/constants/shift4Constants');
    Object.keys(secureCard).forEach(function (field) {
        if (!Constants.CARD_FIELDS.includes(field)) {
            delete secureCard[field];
        }
    });

    return secureCard;
};

/**
 * @description Mask the secret fields of a card
 * @param {object} card Card details to mask
 * @returns {object} Masked card details
 */
module.exports.maskCardDetails = function (card) {
    var Constants = require('*/cartridge/constants/shift4Constants');
    Object.keys(card).forEach(function (key) {
        var value = card[key];
        if (!value) {
            return;
        }
        if (typeof value === 'object') {
            module.exports.maskCardDetails(value);
        } else if (typeof value === 'string' && Constants.SECRET_FIELDS.includes(key)) {
            card[key] = value.replace(/./g, '*');
        }
    });
    return card;
};

/**
 * @description Convert a Shift4 error code to a DW status
 * @param {string} errorCode Error code from Shift4
 * @returns {dw.system.Status} Error status
 */
module.exports.getErrorStatus = function (errorCode) {
    var Status = require('dw/system/Status');
    var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
    switch (errorCode) {
        case 'invalid_cvc':
            return new Status(Status.ERROR, PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE);
        case 'invalid_expiry_month':
        case 'invalid_expiry_year':
        case 'expired_card':
            return new Status(Status.ERROR, PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE);
        case 'invalid_card':
        default:
            return new Status(Status.ERROR, PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER);
    }
};
