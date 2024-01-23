'use strict';

/**
 * @typedef {Object} CardForm
 * @property {string?} [uuid]
 * @property {string} type
 * @property {string} number
 * @property {string} cardholderName
 * @property {number} expMonth
 * @property {number} expYear
 * @property {string} cvc
 * @property {string?} [token]
 */

/**
 * @description Architecture-agnostic handler for tokenizing the order payment instrument and saving it to the customer's profile if requested
 * @param {CardForm} card - The card form data
 * @param {dw.order.Basket} basket - The current basket
 * @param {string} paymentMethodID - The ID of the payment method to handle (CREDIT_CARD)
 * @param {boolean} saveCard - Whether to save the card to the customer's profile
 * @param {function} applyCardErrorsToForm - Function to handle card errors and apply them to the form
 * @returns {HookResponse} Response to relay to the system
 */
module.exports.Handle = function (card, basket, paymentMethodID, saveCard, applyCardErrorsToForm) {
    var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
    var CustomerHelpers = require('*/cartridge/scripts/shift4/helpers/customer');
    var HookResponse = require('*/cartridge/models/shift4/hookResponse');
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var Transaction = require('dw/system/Transaction');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var Resource = require('dw/web/Resource');

    var response = new HookResponse();

    var isCustomerLoggedIn = !!(customer.registered && customer.authenticated && customer.profile);

    try {
        var paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodID);

        if (null == paymentMethod) {
            response.addServerError(Resource.msgf('error.method.not.exists', 'int_shift4', null));
            return response;
        }

        if (paymentMethodID !== PaymentInstrument.METHOD_CREDIT_CARD) {
            response.addServerError(
                Resource.msgf('error.method.not.supported', 'int_shift4', null, paymentMethod.getName())
            );
            return response;
        }

        var shift4CustomerId = isCustomerLoggedIn ? customer.profile.custom.shift4payments__customerId : null;

        if (!card.token) {
            // Verify that the card details are formatted correctly and the merchant supports the card type
            var verificationResult = CardHelpers.verify(paymentMethod, card);
            if (verificationResult.status.error) {
                applyCardErrorsToForm(verificationResult.status, response);
                return response;
            } else if (verificationResult.paymentCard) {
                card.type = verificationResult.paymentCard.cardType;
            }

            // The card has now been validated. Tokenize it and save it to the order payment instrument
            // If the customer is logged in and opted to save the card to their profile, save it to their profile
            try {
                if (saveCard && isCustomerLoggedIn) {
                    if (shift4CustomerId) {
                        var shift4Card = CustomerHelpers.addCard(shift4CustomerId, card, basket);
                        card.token = shift4Card.id;
                    } else {
                        var shift4Customer = CustomerHelpers.create(customer.profile, card, basket);
                        shift4CustomerId = shift4Customer.id;
                        card.token = shift4Customer.cards[0].id;
                    }
                } else {
                    var token = CardHelpers.tokenize(card, basket);
                    card.token = token.id;
                }
            } catch (error) {
                if (error.responseBody) {
                    var responseBody = JSON.parse(error.responseBody);
                    if (responseBody.error && responseBody.error.code) {
                        var errorStatus = CardHelpers.getErrorStatus(responseBody.error.code);
                        applyCardErrorsToForm(errorStatus, response);
                    }
                }
                response.addServerError(Resource.msg('error.payment.not.valid', 'checkout', null));
                return response;
            }
        }

        if (!card.token) {
            response.addServerError(Resource.msg('error.payment.not.valid', 'checkout', null));
            return response;
        }

        // Write card token to the database
        Transaction.begin();

        if (isCustomerLoggedIn) {
            if (shift4CustomerId) {
                customer.profile.custom.shift4payments__customerId = shift4CustomerId;
            }

            if (saveCard) {
                var createCustomerPaymentInstrument = false;
                if (card.uuid) {
                    // If the customer selected a payment instrument from their wallet and the token has changed,
                    // remove the old payment instrument and create a new one
                    var customerPaymentInstruments = customer.profile.wallet.paymentInstruments.iterator();
                    while (customerPaymentInstruments.hasNext()) {
                        var customerPaymentInstrument = customerPaymentInstruments.next();
                        if (customerPaymentInstrument.UUID === card.uuid) {
                            if (card.token !== customerPaymentInstrument.creditCardToken) {
                                customer.profile.wallet.removePaymentInstrument(customerPaymentInstrument);
                                createCustomerPaymentInstrument = true;
                            }
                            break;
                        }
                    }
                } else {
                    createCustomerPaymentInstrument = true;
                }

                if (createCustomerPaymentInstrument) {
                    var customerPaymentInstrument = customer.profile.wallet.createPaymentInstrument(paymentMethodID);
                    customerPaymentInstrument.setCreditCardHolder(card.cardholderName);
                    customerPaymentInstrument.setCreditCardType(card.type);
                    customerPaymentInstrument.setCreditCardNumber(card.number);
                    customerPaymentInstrument.setCreditCardExpirationMonth(card.expMonth);
                    customerPaymentInstrument.setCreditCardExpirationYear(card.expYear);
                    customerPaymentInstrument.setCreditCardToken(card.token);
                }
            }
        }

        // Remove existing payment instruments from the order, in case authorization failed and the customer is retrying
        var paymentInstruments = basket.getPaymentInstruments(paymentMethodID).iterator();
        while (paymentInstruments.hasNext()) {
            basket.removePaymentInstrument(paymentInstruments.next());
        }

        var orderPaymentInstrument = basket.createPaymentInstrument(paymentMethodID, basket.totalGrossPrice);
        orderPaymentInstrument.setCreditCardHolder(card.cardholderName);
        orderPaymentInstrument.setCreditCardType(card.type);
        orderPaymentInstrument.setCreditCardNumber(card.number);
        orderPaymentInstrument.setCreditCardExpirationMonth(card.expMonth);
        orderPaymentInstrument.setCreditCardExpirationYear(card.expYear);
        orderPaymentInstrument.setCreditCardToken(card.token);

        Transaction.commit();
    } catch (error) {
        response.addServerError(Resource.msg('error.technical', 'checkout', null));
    }

    return response;
};
