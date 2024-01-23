'use strict';

/**
 * ----------------------------------------------
 *    app.payment.form.processor.shift4_credit
 * ----------------------------------------------
 */

/**
 * Verifies the required information for billing form is provided.
 * @param {SfraRequest} request - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
module.exports.processForm = function (request, paymentForm, viewData) {
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    if (!request.form.storedPaymentUUID) {
        // verify credit card form data
        var creditCardErrors = COHelpers.validateCreditCard(paymentForm);

        if (Object.keys(creditCardErrors).length) {
            return {
                fieldErrors: creditCardErrors,
                error: true
            };
        }
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        cardType: {
            value: paymentForm.creditCardFields.cardType.value,
            htmlName: paymentForm.creditCardFields.cardType.htmlName
        },
        cardNumber: {
            value: paymentForm.creditCardFields.cardNumber.value,
            htmlName: paymentForm.creditCardFields.cardNumber.htmlName
        },
        securityCode: {
            value: paymentForm.creditCardFields.securityCode.value,
            htmlName: paymentForm.creditCardFields.securityCode.htmlName
        },
        expirationMonth: {
            value: parseInt(paymentForm.creditCardFields.expirationMonth.selectedOption, 10),
            htmlName: paymentForm.creditCardFields.expirationMonth.htmlName
        },
        expirationYear: {
            value: parseInt(paymentForm.creditCardFields.expirationYear.value, 10),
            htmlName: paymentForm.creditCardFields.expirationYear.htmlName
        }
    };

    if (request.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = request.form.storedPaymentUUID;
    }

    viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;

    // Use a stored payment method
    if (
        viewData.storedPaymentUUID &&
        customer.authenticated &&
        customer.registered &&
        customer.profile &&
        customer.profile.wallet
    ) {
        var paymentInstruments = customer.profile.wallet.paymentInstruments.iterator();
        var paymentInstrument;
        while (!paymentInstrument && paymentInstruments.hasNext()) {
            var savedPaymentInstrument = paymentInstruments.next();
            if (viewData.storedPaymentUUID === savedPaymentInstrument.UUID) {
                paymentInstrument = savedPaymentInstrument;
            }
        }

        if (paymentInstrument) {
            viewData.paymentInformation.cardNumber.value = paymentInstrument.creditCardNumber;
            viewData.paymentInformation.cardType.value = paymentInstrument.creditCardType;
            viewData.paymentInformation.securityCode.value = request.form.securityCode;
            viewData.paymentInformation.expirationMonth.value = paymentInstrument.creditCardExpirationMonth;
            viewData.paymentInformation.expirationYear.value = paymentInstrument.creditCardExpirationYear;
            viewData.paymentInformation.creditCardToken = paymentInstrument.creditCardToken;
            viewData.paymentInformation.storedPaymentUUID = paymentInstrument.UUID;
        }
    }

    return {
        error: false,
        viewData: viewData
    };
};

/**
 * @description Save the credit card information to login account if save card option is selected
 * @param {SfraRequest} request - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 * @returns {void}
 */
module.exports.savePaymentInformation = function (request, basket, billingData) {
    // Saving payment information is contained to the shift4Credit.Handle hook to reduce callouts to Shift4 during payment processing
};
