'use strict';

/**
 * @description Create a customer in Shift4 for a specific customer
 * @param {dw.customer.Profile} profile Customer profile
 * @param {Object | string | undefined} card Optional card to add to customer
 * @param {dw.order.LineItemCtnr | null | undefined} lineItemContainer The order or basket to apply billing info from
 * @returns {Object} New Customer Object
 */
module.exports.create = function (profile, card, lineItemContainer) {
    if (profile.custom.shift4payments__customerId && profile.custom.shift4payments__customerId.startsWith('cust_')) {
        return;
    }
    var Site = require('dw/system/Site').current;
    var customerPayload = {
        email: profile.email,
        description: 'Customer ' + profile.customerNo + ' on the ' + Site.name + ' Storefront.',
        metadata: {
            b2cCustomerNumber: profile.customerNo,
            b2cCustomerID: profile.customer.ID,
            b2cSiteID: Site.ID
        }
    };
    if (card) {
        if (typeof card === 'object') {
            var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
            customerPayload.card = CardHelpers.secureCardDetails(card, lineItemContainer);
        } else {
            customerPayload.card = card;
        }
    }
    var shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    return shift4API.customer.create(customerPayload);
};

/**
 * @description Add a card to the shift4 customer
 * @param {string} customerId Shift4 Customer ID
 * @param {Object | string} card The card to add. Either a token ID or credit card details
 * @param {dw.order.LineItemCtnr | null | undefined} lineItemContainer The order or basket to apply billing info from
 * @returns {Object} New card Object
 */
module.exports.addCard = function (customerId, card, lineItemContainer) {
    var payload;
    if (typeof card === 'string') {
        payload = {
            id: card
        };
    } else {
        var CardHelpers = require('*/cartridge/scripts/shift4/helpers/card');
        payload = CardHelpers.secureCardDetails(card, lineItemContainer);
    }
    var shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    return shift4API.customer.cards.add(customerId, payload);
};

/**
 * @description Delete a card from a shift4 customer's profile
 * @param {string} customerId Shift4 Customer ID
 * @param {string} cardId Shift4 Card ID
 */
module.exports.removeCard = function (customerId, cardId) {
    var shift4API = require('*/cartridge/scripts/shift4/services/shift4API');
    shift4API.customer.cards.remove(customerId, cardId);
};
