'use strict';

/**
 * ----------------------------------------------
 *      app.payment.processor.SHIFT4_CREDIT
 * ----------------------------------------------
 */

var HookResponse = require('*/cartridge/models/shift4/hookResponse');

/**
 * @typedef {Object} HandlePaymentArguments The arguments passed to the extension point
 * @property {dw.order.Basket} Basket The current basket
 * @property {string} PaymentMethodID The ID of the payment method to handle
 */

/**
 * @description Tokenizes the order payment instrument
 * @param {HandlePaymentArguments} args Handle Payment Arguments
 * @returns {HookResponse} Status
 */
module.exports.Handle = function (args) {
    var CreditHelpers = require('*/cartridge/scripts/shift4/helpers/credit');

    /**
     * @description Handle a card error and apply it to the form
     * @param {dw.system.Status} status Error status object
     * @param {HookResponse} response Response to relay to the system
     */
    function applyCardErrorsToForm(status, response) {
        var Resource = require('dw/web/Resource');
        var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
        var items = status.items.iterator();
        while (items.hasNext()) {
            var item = items.next();
            switch (item.code) {
                case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                    creditCardForm.number.setValue(creditCardForm.number.htmlValue);
                    creditCardForm.number.invalidateFormElement();
                    break;

                case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                    creditCardForm.expiration.month.invalidateFormElement();
                    creditCardForm.expiration.year.invalidateFormElement();
                    break;

                case PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE:
                    creditCardForm.cvn.invalidateFormElement();
                    break;

                default:
                    response.addServerError(Resource.msg('error.card.information.error', 'creditCard', null));
            }
        }
    }

    // Extract data from intake form
    var paymentForm = session.forms.billing['paymentMethods'];
    var creditCardForm = paymentForm.creditCard;
    var card = {
        uuid: request.httpParameterMap.get(paymentForm.creditCardList.getHtmlName()).stringValue,
        cardholderName: creditCardForm.owner.value,
        type: creditCardForm.type.value,
        number: creditCardForm.number.value,
        expMonth: creditCardForm.expiration.month.value,
        expYear: creditCardForm.expiration.year.value,
        cvc: creditCardForm.cvn.value
    };

    // Check if the customer selected a payment instrument from their wallet
    if (card.uuid && customer.registered && customer.authenticated && customer.profile) {
        var customerPaymentInstruments = customer.profile.wallet.paymentInstruments.iterator();
        while (customerPaymentInstruments.hasNext()) {
            var customerPaymentInstrument = customerPaymentInstruments.next();
            if (customerPaymentInstrument.UUID === card.uuid) {
                card.uuid = customerPaymentInstrument.UUID;
                card.token = customerPaymentInstrument.creditCardToken;
                break;
            }
        }
    }
    return CreditHelpers.Handle(
        card,
        args.Basket,
        args.PaymentMethodID,
        creditCardForm.saveCard.value,
        applyCardErrorsToForm
    );
};

/**
 * @typedef {object} AuthorizePaymentArguments The arguments passed to the extension point
 * @property {dw.order.OrderPaymentInstrument} PaymentInstrument Order Payment Instrument
 * @property {dw.order.Order} Order Order Instance
 * @property {string} OrderNo Order Number
 */

/**
 * @description Handles the authorization of a payment instrument and creates a charge in Shift4
 * @param {AuthorizePaymentArguments} args payment authorization arguments
 * @returns {HookResponse} Hook Response
 */
module.exports.Authorize = function (args) {
    var Resource = require('dw/web/Resource');
    var response = new HookResponse();

    try {
        var BillingHelpers = require('*/cartridge/scripts/shift4/helpers/billing');
        BillingHelpers.chargePaymentInstrument(args.Order, args.PaymentInstrument);
    } catch (e) {
        response.addServerError(Resource.msg('error.payment.not.valid', 'checkout', null));
    }

    return response;
};
