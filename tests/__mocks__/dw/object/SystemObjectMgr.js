'use strict';
/* MOCK */

const OBJECT_DESCRIBE_MAP = {
    SitePreferences: {
        attributeDefinitions: {
            toArray: function () {
                return [
                    { ID: 'shift4payments__applePayVerificationString' },
                    { ID: 'shift4payments__captureImmediately' },
                    { ID: 'shift4payments__environment' },
                    { ID: 'shift4payments__livePublicKey' },
                    { ID: 'shift4payments__liveSecretKey' },
                    { ID: 'shift4payments__testSecretKey' },
                    { ID: 'shift4payments__testSecretKey' }
                ];
            }
        }
    }
};

module.exports.describe = function (objectName) {
    return OBJECT_DESCRIBE_MAP[objectName];
};
