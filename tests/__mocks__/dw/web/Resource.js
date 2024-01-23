'use strict';

module.exports.msg = function (key, bundleName, defaultMessage) {
    if (defaultMessage) {
        return defaultMessage;
    }
    return key;
};

module.exports.msgf = function (key, bundleName, defaultMessage, ...args) {
    if (defaultMessage) {
        return defaultMessage;
    }
    return key;
};
