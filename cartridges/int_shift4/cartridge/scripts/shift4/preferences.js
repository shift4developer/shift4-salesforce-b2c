'use strict';

/**
 * ----------------------------------------------
 *                 LIBRARIES
 * ----------------------------------------------
 */

var SystemObjectMgr = require('dw/object/SystemObjectMgr');
var Constants = require('*/cartridge/constants/shift4Constants');

/**
 * ----------------------------------------------
 *              MODULE PROPERTIES
 * ----------------------------------------------
 */

var preferencesDescribe = SystemObjectMgr.describe('SitePreferences');
var currentSitePreferences = require('dw/system/Site').current.preferences.custom;
var pendingWrites = {}; // Track any updates to preference fields until commit() is called
var preferences = {}; // Site Preference properties are defined in here to be accessed externally

// Apply each site preference field with the shift4 namespace to the preferences object.
preferencesDescribe.attributeDefinitions.toArray().forEach(function (attribute) {
    var fieldName = attribute.ID;
    if (fieldName.includes(Constants.NAMESPACE_API) && !preferences.hasOwnProperty(fieldName)) {
        Object.defineProperty(preferences, fieldName, {
            get: function () {
                // If a value has been written, use that value
                if (typeof pendingWrites[fieldName] !== 'undefined') {
                    return pendingWrites[fieldName];
                }
                // Else, read from the db
                var value = currentSitePreferences[fieldName];
                if (typeof value === 'object' && value) {
                    value = value.value; // Picklist option value
                }
                return value;
            },
            set: function (value) {
                if (value !== preferences[fieldName]) {
                    pendingWrites[fieldName] = value;
                }
            }
        });
    }
});

// Export the property values directly for easy access
module.exports.custom = preferences;

/**
 * @description Get a custom preference
 * @param {string} fieldName - The field to get
 * @returns {string | boolean} - The value of the custom preference
 */
module.exports.get = function (fieldName) {
    return preferences[fieldName];
};

/**
 * @description Set a custom preference value
 * @param {string} fieldName - The field to set
 * @param {string | boolean} value - The value to set to the custom preference
 * @throws {Error} If the fieldName is invalid
 */
module.exports.put = function (fieldName, value) {
    if (!preferences.hasOwnProperty(fieldName)) {
        throw new Error('Invalid Site Preferences Property: ' + fieldName);
    }
    preferences[fieldName] = value;
};

module.exports.isLiveMode = function () {
    return preferences.shift4payments__environment === Constants.MODE.LIVE;
};

/**
 * @description Get The current site preferences as a json object. This is necessary because the export property values wont appear in JSON.stringify
 * @returns {object} - A snapshot of all the site preferences for shift4. Secret fields are masked
 */
module.exports.getSnapshot = function () {
    var snapshot = {};
    Object.getOwnPropertyNames(preferences).forEach(function (fieldName) {
        var value = currentSitePreferences[fieldName];
        if (Constants.SECRET_PREFERENCES.includes(fieldName) && value) {
            var regex = new RegExp('sk_(live|test)_');
            if (regex.test(value)) {
                var prefix = value.match(regex)[0];
                value = prefix + value.replace(/./g, Constants.BLUR_CHAR);
            } else {
                value = value.replace(/./g, Constants.BLUR_CHAR);
            }
        }
        snapshot[fieldName] = value;
    });
    return snapshot;
};

/**
 * @description Commit any custom preference settings that were changed
 */
module.exports.commit = function () {
    var Transaction = require('dw/system/Transaction');
    Transaction.wrap(function () {
        Object.keys(pendingWrites).forEach(function (fieldName) {
            currentSitePreferences[fieldName] = pendingWrites[fieldName];
        });
    });
};
