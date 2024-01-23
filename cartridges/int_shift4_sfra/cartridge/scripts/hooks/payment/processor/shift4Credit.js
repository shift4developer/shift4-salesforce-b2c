/* global dw */
'use strict';

/**
 * ----------------------------------------------
 *      app.payment.processor.shift4_credit
 * ----------------------------------------------
 */

var HookResponse = require('*/cartridge/models/shift4/hookResponse');

/**
 * @description A hook to create a token for a given payment method
 * @returns {string} The tokenized payment method
 */
module.exports.createToken = function () {
    var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
    var CustomerHelpers = require('*/cartridge/scripts/shift4/helpers/customer');
    var BasketMgr = require('dw/order/BasketMgr');

    var card = {
        cardholderName: session.forms.creditCard.cardOwner.value,
        number: session.forms.creditCard.cardNumber.value,
        expMonth: session.forms.creditCard.expirationMonth.value,
        expYear: session.forms.creditCard.expirationYear.value,
        cvc: session.forms.creditCard.securityCode.value
    };

    if (customer.registered && customer.authenticated && customer.profile) {
        if (customer.profile.custom.shift4payments__customerId) {
            var shift4Card = CustomerHelpers.addCard(
                customer.profile.custom.shift4payments__customerId,
                card,
                BasketMgr.getCurrentBasket()
            );
            return shift4Card.id;
        } else {
            var shift4Customer = CustomerHelpers.create(customer.profile, card, BasketMgr.getCurrentBasket());
            customer.profile.custom.shift4payments__customerId = shift4Customer.id;
            return shift4Customer.cards[0].id;
        }
    }

    var token = CardHelpers.tokenize(card, BasketMgr.getCurrentBasket());
    return token.id;
};

/**
 * @description Verifies that entered credit card information is a valid card. If the information is valid, the card is tokenized and saved to a new PaymentInstrument
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation The card details
 * @param {string} paymentMethodID Payment Method ID (CREDIT_CARD)
 * @param {SfraRequest} request The Http request object
 * @return {Object} returns an error object
 */
module.exports.Handle = function (basket, paymentInformation, paymentMethodID, request) {
    var CreditHelpers = require('*/cartridge/scripts/shift4/helpers/credit');
    var Resource = require('dw/web/Resource');

    /**
     * @description Handle a card error and apply it to the form
     * @param {dw.system.Status} status Error status object
     * @param {HookResponse} response Response object
     */
    function applyCardErrorsToForm(status, response) {
        var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
        var statusItems = status.items.iterator();
        while (statusItems.hasNext()) {
            var item = statusItems.next();
            switch (item.code) {
                case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                    response.addFieldError(
                        paymentInformation.cardNumber.htmlName,
                        Resource.msg('error.invalid.card.number', 'creditCard', null)
                    );
                    break;

                case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                    response.addFieldError(
                        paymentInformation.expirationMonth.htmlName,
                        Resource.msg('error.expired.credit.card', 'creditCard', null)
                    );
                    response.addFieldError(
                        paymentInformation.expirationYear.htmlName,
                        Resource.msg('error.expired.credit.card', 'creditCard', null)
                    );
                    break;

                case PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE:
                    response.addFieldError(
                        paymentInformation.securityCode.htmlName,
                        Resource.msg('error.invalid.security.code', 'creditCard', null)
                    );
                    break;
                default:
                    response.addServerError(Resource.msg('error.card.information.error', 'creditCard', null));
            }
        }
    }

    var saveCard = !!session.forms.billing.creditCardFields.saveCard.value;
    var card = {
        uuid: paymentInformation.storedPaymentUUID,
        cardholderName: basket.billingAddress ? basket.billingAddress.fullName : basket.customerName,
        type: paymentInformation.cardType.value,
        number: paymentInformation.cardNumber.value,
        expMonth: paymentInformation.expirationMonth.value,
        expYear: paymentInformation.expirationYear.value,
        cvc: paymentInformation.securityCode.value,
        token: paymentInformation.creditCardToken
    };

    return CreditHelpers.Handle(card, basket, paymentMethodID, saveCard, applyCardErrorsToForm);
};

/**
 * @description Authorizes a payment using a credit card. Creates a charge in Shift4
 * @param {string} orderNumber The current order's number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor The payment processor of the current payment method
 * @return {HookResponse} Contains error info if any errors occurred
 */
module.exports.Authorize = function (orderNumber, paymentInstrument, paymentProcessor) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');

    var response = new HookResponse();

    try {
        var order = OrderMgr.getOrder(orderNumber);
        if (null == order) {
            response.addServerError(Resource.msgf('error.order.not.exists', 'int_shift4', null, orderNumber));
            return response;
        }

        var BillingHelpers = require('*/cartridge/scripts/shift4/helpers/billing');
        BillingHelpers.chargePaymentInstrument(order, paymentInstrument);
    } catch (e) {
        response.addServerError(Resource.msg('error.payment.not.valid', 'checkout', null));
    }

    return response;
};
