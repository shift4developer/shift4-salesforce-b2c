'use strict';

/**
 * @namespace PaymentInstruments
 */

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var Resource = require('dw/web/Resource');

/**
 * @description Handle a card error and apply it to the form
 * @param {dw.system.Status} status Status with errors to apply to the form
 * @param {SfraFormCreditCard} form Form to apply errors to
 */
function applyCardErrorsToForm(status, form) {
    var collections = require('*/cartridge/scripts/util/collections');
    var PaymentStatusCodes = require('dw/order/PaymentStatusCodes');
    collections.forEach(status.items, function (item) {
        switch (item.code) {
            case PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE:
            case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                form.cardNumber.valid = false;
                form.cardNumber.error = Resource.msg('error.message.creditnumber.invalid', 'forms', null);
                break;

            case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                form.expirationMonth.error = Resource.msg('error.message.creditexpiration.expired', 'forms', null);
                form.expirationYear.error = Resource.msg('error.message.creditexpiration.expired', 'forms', null);
                form.expirationMonth.valid = false;
                form.expirationYear.valid = false;
                break;
        }
    });
}

/**
 * @description PaymentInstruments-SavePayment : The PaymentInstruments-SavePayment endpoint is responsible for saving a shopper's card to their account
 * @name Shift4/PaymentInstruments-SavePayment
 * @param {SfraRequest} req
 * @param {SfraResponse} res
 * @param {function} next
 */
server.replace('SavePayment', csrfProtection.validateAjaxRequest, function (req, res, next) {
    var formErrors = require('*/cartridge/scripts/formErrors');
    var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');

    var OrderPaymentInstrument = require('dw/order/PaymentInstrument');
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var Transaction = require('dw/system/Transaction');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var HookMgr = require('dw/system/HookMgr');
    var URLUtils = require('dw/web/URLUtils');

    var paymentForm = server.forms.getForm('creditCard');

    /**
     * ----------------------------------
     * Shift4 Architectural Changes Begin
     */

    //var customer = CustomerMgr.getCustomerByCustomerNumber(req.currentCustomer.profile.customerNo);
    var customer = req.currentCustomer.raw;

    if (!customer || !customer.profile) {
        res.redirect(URLUtils.url('Login-Show'));
        return next();
    }

    var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
    if (!creditCardPaymentMethod) {
        res.json({
            success: false,
            fields: formErrors.getFormErrors(paymentForm),
            errorMessage: Resource.msg('error.method.not.exists', 'int_shift4', null)
        });
        return next();
    }

    var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
    var cardPayload = {
        cardholderName: paymentForm.cardOwner.value,
        number: paymentForm.cardNumber.value,
        expMonth: paymentForm.expirationMonth.value.toString(),
        expYear: paymentForm.expirationYear.value.toString(),
        cvc: paymentForm.securityCode.value
    };
    var verificationResult = CardHelpers.verify(creditCardPaymentMethod, cardPayload);

    var cardIsVerified = !verificationResult.status.error;

    if (!paymentForm.valid || !cardIsVerified || !verificationResult.paymentCard) {
        applyCardErrorsToForm(verificationResult.status, paymentForm);
        res.json({
            success: false,
            fields: formErrors.getFormErrors(paymentForm)
        });
        return next();
    }

    paymentForm.cardType.value = verificationResult.paymentCard.cardType;

    var cardFormInfo = {
        name: paymentForm.cardOwner.value,
        cardNumber: paymentForm.cardNumber.value,
        cardType: paymentForm.cardType.value,
        expirationMonth: paymentForm.expirationMonth.value,
        expirationYear: paymentForm.expirationYear.value,
        paymentForm: paymentForm
    };

    //this.on('route:BeforeComplete', function () {
    // eslint-disable-line no-shadow

    var wallet = customer.profile.getWallet();
    var processor = creditCardPaymentMethod.paymentProcessor;

    /**
     * --------------------
     * Shift4 Changes Begin
     */
    var CustomerHelpers = require('*/cartridge/scripts/shift4/helpers/customer');
    var Constants = require('*/cartridge/constants/shift4Constants');
    var shift4IsEnabled = processor.ID === Constants.PAYMENT_PROCESSORS.SHIFT4_CREDIT;
    var shift4CustomerId = customer.profile.custom.shift4payments__customerId;
    var shift4CardId;
    if (shift4IsEnabled) {
        try {
            if (shift4CustomerId) {
                var shift4Card = CustomerHelpers.addCard(shift4CustomerId, cardPayload, null);
                shift4CardId = shift4Card.id;
            } else {
                var shift4Customer = CustomerHelpers.create(customer.profile, cardPayload, null);
                shift4CustomerId = shift4Customer.id;
                shift4CardId = shift4Customer.cards[0].id;
            }
        } catch (error) {
            if (error.responseBody) {
                var responseBody = JSON.parse(error.responseBody);
                if (responseBody.error && responseBody.error.code) {
                    var errorStatus = CardHelpers.getErrorStatus(responseBody.error.code);
                    applyCardErrorsToForm(errorStatus, paymentForm);
                }
            }
            res.json({
                success: false,
                fields: formErrors.getFormErrors(paymentForm)
            });
            return next();
        }
    }
    /**
     * Shift4 Changes End
     * ------------------
     */

    Transaction.begin();

    var paymentInstrument = wallet.createPaymentInstrument(OrderPaymentInstrument.METHOD_CREDIT_CARD);
    paymentInstrument.setCreditCardHolder(cardFormInfo.name);
    paymentInstrument.setCreditCardType(cardFormInfo.cardType);
    paymentInstrument.setCreditCardNumber(cardFormInfo.cardNumber);
    paymentInstrument.setCreditCardExpirationMonth(cardFormInfo.expirationMonth);
    paymentInstrument.setCreditCardExpirationYear(cardFormInfo.expirationYear);

    /**
     * --------------------
     * Shift4 Changes Begin
     */
    if (shift4IsEnabled) {
        customer.profile.custom.shift4payments__customerId = shift4CustomerId;
        paymentInstrument.setCreditCardToken(shift4CardId);
    } else {
        var token = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(), 'createToken');
        paymentInstrument.setCreditCardToken(token);
    }
    /**
     * Shift4 Changes End
     * ------------------
     */

    Transaction.commit();

    // Send account edited email
    accountHelpers.sendAccountEditedEmail(customer.profile);

    res.json({
        success: true,
        redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
    });
    //});

    /**
     * Shift4 Architectural Changes End
     * --------------------------------
     */

    return next();
});

/**
 * @description PaymentInstruments-DeletePayment : The PaymentInstruments-DeletePayment endpoint is responsible for deleting a shopper's saved payment instrument from their account
 * @name Shift4/PaymentInstruments-DeletePayment
 * @memberof PaymentInstruments
 * @param {SfraRequest} req
 * @param {SfraResponse} res
 * @param {function} next
 */
server.prepend('DeletePayment', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    if (!customer.profile || !customer.profile.wallet) {
        return next();
    }
    var Collections = require('*/cartridge/scripts/util/collections');
    var CustomerHelpers = require('*/cartridge/scripts/shift4/helpers/customer');
    var paymentInstruments = customer.profile.wallet.paymentInstruments;
    var paymentToDelete = Collections.find(paymentInstruments, function (item) {
        return req.querystring.UUID === item.UUID;
    });
    var shift4CardId = paymentToDelete ? paymentToDelete.creditCardToken : null;
    if (!shift4CardId || !customer.profile || !customer.profile.custom.shift4payments__customerId) {
        return next();
    }
    try {
        CustomerHelpers.removeCard(customer.profile.custom.shift4payments__customerId, shift4CardId);
    } catch (ignored) {
        return next();
    }
    return next();
});

module.exports = server.exports();
