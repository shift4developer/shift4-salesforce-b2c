'use strict';

/**
 * @description Create a charge in Shift4 with an order and payment instrument
 * @param {dw.order.Order} order The order to charge against
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument The payment instrument to charge with
 * @throws {Error} If something goes wrong
 */
module.exports.chargePaymentInstrument = function (order, paymentInstrument) {
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var Transaction = require('dw/system/Transaction');
    var Currency = require('dw/util/Currency');
    var Site = require('dw/system/Site').current;

    var token = paymentInstrument.creditCardToken;

    // The card must be tokenized
    if (!token || !token.match(/(tok_*|card_*|pm_*)/)) {
        throw new Error('The card has not been tokenized. Unable to create charge');
    }

    var payload = {
        captured: SitePreferences.custom.shift4payments__captureImmediately,
        description: 'Order No. ' + order.orderNo + ' on the ' + Site.name + ' Storefront.',
        type: 'customer_initiated',
        metadata: {
            b2cOrderNumber: order.orderNo,
            b2cOrderID: order.UUID,
            b2cSiteID: Site.ID
        }
    };

    var isAPM = token.match(/(pm_*)/);

    if (isAPM) {
        payload.paymentMethod = token;
    } else {
        payload.card = token;
    }

    // Apply Shift4 Customer ID, if available
    var customer = order.customer;
    if (customer && customer.profile && customer.profile.custom.shift4payments__customerId) {
        payload.customerId = customer.profile.custom.shift4payments__customerId;
    }

    // Set charge amount & currency. Prefer payment transaction, but line item container works too
    if (null != paymentInstrument.paymentTransaction) {
        var currency = Currency.getCurrency(paymentInstrument.paymentTransaction.amount.currencyCode);
        var multiplier = Math.pow(10, currency.getDefaultFractionDigits());
        var amount = Math.round(paymentInstrument.paymentTransaction.amount.value * multiplier);
        payload.amount = amount;
        payload.currency = currency.currencyCode;
    } else {
        var currency = Currency.getCurrency(order.currencyCode);
        var multiplier = Math.pow(10, currency.getDefaultFractionDigits());
        var amount = Math.round(order.totalGrossPrice.value * multiplier);
        payload.amount = amount;
        payload.currency = currency.currencyCode;
    }

    // Only set billing address if the card is not an APM ID and the order has a billing address
    if (!isAPM && order.billingAddress) {
        payload.billing = {
            name: order.billingAddress.fullName,
            address: {
                line1: order.billingAddress.address1,
                line2: order.billingAddress.address2,
                city: order.billingAddress.city,
                state: order.billingAddress.stateCode,
                zip: order.billingAddress.postalCode,
                country: order.billingAddress.countryCode.value.toUpperCase()
            }
        };
    }

    // Search for the first shipment with a shipping address
    var shipments = order.shipments.iterator();
    while (shipments.hasNext() && !payload.shipping) {
        var shipment = shipments.next();
        if (shipment.shippingAddress) {
            payload.shipping = {
                name: shipment.shippingAddress.fullName,
                address: {
                    line1: shipment.shippingAddress.address1,
                    line2: shipment.shippingAddress.address2,
                    city: shipment.shippingAddress.city,
                    state: shipment.shippingAddress.stateCode,
                    zip: shipment.shippingAddress.postalCode,
                    country: shipment.shippingAddress.countryCode.value.toUpperCase()
                }
            };
        }
    }

    // Create the charge in Shift4
    var Shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    var charge = Shift4API.charge.create(payload);

    // Save the charge ID to the transaction
    Transaction.wrap(function () {
        var Order = require('dw/order/Order');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var PaymentTransaction = require('dw/order/PaymentTransaction');
        if (null == paymentInstrument.paymentTransaction) {
            return;
        }

        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod);
        if (null == paymentMethod) {
            throw new Error('Payment method not found');
        }

        paymentInstrument.paymentTransaction.setTransactionID(order.orderNo);
        paymentInstrument.paymentTransaction.setPaymentProcessor(paymentMethod.paymentProcessor);
        paymentInstrument.paymentTransaction.custom.shift4payments__chargeId = charge.id;

        if (charge.captured) {
            paymentInstrument.paymentTransaction.setType(PaymentTransaction.TYPE_CAPTURE);
            if (null != order) {
                var amountPaid = paymentInstrument.paymentTransaction.amount.value;
                if (amountPaid === 0) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
                } else if (amountPaid < order.totalGrossPrice.value) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PARTPAID);
                } else {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                }
            }
        } else {
            paymentInstrument.paymentTransaction.setType(PaymentTransaction.TYPE_AUTH);
            if (null != order) {
                order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
            }
        }
    });
};
