'use strict';

/**
 * @description Render the setup page template with a snapshot of the current site preference values
 */
function Show() {
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var ResponseData = require('*/cartridge/models/shift4/responseData');
    var SetupHelpers = require('*/cartridge/scripts/shift4SetupHelpers');
    var URLUtils = require('dw/web/URLUtils');
    var responseData = new ResponseData();
    try {
        responseData.results.preferences = SitePreferences.getSnapshot();
        responseData.results.urls = {
            symbols: URLUtils.staticURL('/icons/utility-sprite/svg/symbols.svg').toString(),
            save: URLUtils.https('Shift4SetupController-Save').toString(),
            authenticate: URLUtils.https('Shift4SetupController-AuthenticateOutbound').toString(),
            deauthenticate: URLUtils.https('Shift4SetupController-DeauthenticateOutbound').toString()
        };
    } catch (error) {
        responseData.addError(error);
        response.setStatus(500);
    }

    if (!SitePreferences.custom.shift4payments__applePayVerificationString) {
        var ApplePayHelpers = require('*/cartridge/scripts/shift4/helpers/applepay');
        SitePreferences.custom.shift4payments__applePayVerificationString =
            ApplePayHelpers.fetchApplePayVerificationString();
        SitePreferences.commit();
    }

    var paymentProcessorState = SetupHelpers.getPaymentProcessorState();

    var isLiveMode = SitePreferences.isLiveMode();
    var liveConnectionResponse = SetupHelpers.testOutboundConnection(true);
    responseData.results.liveModeIsConnected = liveConnectionResponse.results.isConnected;
    if (isLiveMode) {
        if (liveConnectionResponse.results.isConnected && paymentProcessorState.disabledPaymentMethods.length) {
            responseData.addWarning(
                SetupHelpers.getDisabledPaymentMethodsWarning(paymentProcessorState.disabledPaymentMethods)
            );
        } else if (!liveConnectionResponse.results.isConnected && paymentProcessorState.isEnabled) {
            responseData.addWarning(liveConnectionResponse.error);
        }
    }

    var testConnectionResponse = SetupHelpers.testOutboundConnection(false);
    responseData.results.testModeIsConnected = testConnectionResponse.results.isConnected;
    if (!isLiveMode) {
        if (testConnectionResponse.results.isConnected && paymentProcessorState.disabledPaymentMethods.length) {
            responseData.addWarning(
                SetupHelpers.getDisabledPaymentMethodsWarning(paymentProcessorState.disabledPaymentMethods)
            );
        } else if (!testConnectionResponse.results.isConnected && paymentProcessorState.isEnabled) {
            responseData.addWarning(testConnectionResponse.error);
        }
    }

    var ISML = require('dw/template/ISML');
    var Resource = require('dw/web/Resource');
    ISML.renderTemplate('extensions/shift4Setup', {
        responseData: responseData.stringify(),
        responseDataObject: responseData,
        breadcrumbs: [
            {
                htmlValue: Resource.msg('breadcrumbs.bm.tools', 'bm_shift4', 'Merchant Tools'),
                url: URLUtils.url(
                    'ViewApplication-CompressMenuGroup',
                    'OverviewPage',
                    'SiteNavigationBar-ShowSiteOverview'
                )
            },
            {
                htmlValue: Resource.msg('breadcrumbs.bm.shift4.menu', 'bm_shift4', 'Shift4'),
                url: URLUtils.url('SiteNavigationBar-ShowMenuitemOverview', 'CurrentMenuItemId', 'shift4')
            },
            {
                htmlValue: Resource.msg('breadcrumbs.bm.shift4.setup', 'bm_shift4', 'Setup')
            }
        ]
    });
}

/**
 * @description Exchange an auth code for tokens to be stored in the Amazon selling partner site preferences
 */
function Save() {
    var ResponseData = require('*/cartridge/models/shift4/responseData');
    var SetupHelpers = require('*/cartridge/scripts/shift4SetupHelpers');
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var SGHelpers = require('*/cartridge/scripts/shift4/helpers/sg');
    var responseData = new ResponseData();
    try {
        // Parse request body
        var requestBodyJson = request.httpParameterMap.getRequestBodyAsString();
        if (null == requestBodyJson) {
            SGHelpers.sendJSON(400, responseData);
            return;
        }
        var requestBody = JSON.parse(requestBodyJson);

        // Apply preferences from request body into the site preferences module
        Object.keys(requestBody).forEach(function (key) {
            SitePreferences.put(key, requestBody[key]);
        });

        // If any outbound connection prefs are in the request body, test the connection
        var paymentProcessorState = SetupHelpers.getPaymentProcessorState();
        if (paymentProcessorState.isEnabled) {
            var connectionResponse = SetupHelpers.testOutboundConnection(SitePreferences.isLiveMode());
            if (connectionResponse.results.isConnected && paymentProcessorState.disabledPaymentMethods.length) {
                responseData.addWarning(
                    SetupHelpers.getDisabledPaymentMethodsWarning(paymentProcessorState.disabledPaymentMethods)
                );
            } else if (!connectionResponse.results.isConnected) {
                responseData.addWarning(connectionResponse.error);
            }
        }
        SitePreferences.commit();

        // Return a snapshot of the site preferences
        responseData.results.preferences = SitePreferences.getSnapshot();
        SGHelpers.sendJSON(200, responseData);
    } catch (error) {
        responseData.addError(error);
        SGHelpers.sendJSON(500, responseData);
    }
}

/**
 * @description Authenticate the outbound connection to shift4 and save the tokens to the site preferences
 */
function AuthenticateOutbound() {
    var ResponseData = require('*/cartridge/models/shift4/responseData');
    var SetupHelpers = require('*/cartridge/scripts/shift4SetupHelpers');
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var SGHelpers = require('*/cartridge/scripts/shift4/helpers/sg');
    var responseData = new ResponseData();
    try {
        // Parse request body
        var requestBodyJson = request.httpParameterMap.getRequestBodyAsString();
        if (null == requestBodyJson) {
            SGHelpers.sendJSON(400, responseData);
            return;
        }
        var requestBody = JSON.parse(requestBodyJson);

        var isLiveMode = requestBody.isLiveMode;
        var mode = isLiveMode ? 'live' : 'test';

        // If a blurred value was passed back, ignore it
        var blurredSecretKey = SitePreferences.getSnapshot()['shift4payments__' + mode + 'SecretKey'];
        if (requestBody.secretKey !== blurredSecretKey) {
            SitePreferences.put('shift4payments__' + mode + 'SecretKey', requestBody.secretKey);
        }
        SitePreferences.put('shift4payments__' + mode + 'PublicKey', requestBody.publicKey);

        var connectionResponse = SetupHelpers.testOutboundConnection(isLiveMode);
        if (connectionResponse.results.isConnected) {
            SitePreferences.commit();

            // Add a warning if there are payment methods that won't be used by this newly established connection
            var paymentProcessorState = SetupHelpers.getPaymentProcessorState();
            if (paymentProcessorState.disabledPaymentMethods.length) {
                responseData.addWarning(
                    SetupHelpers.getDisabledPaymentMethodsWarning(paymentProcessorState.disabledPaymentMethods)
                );
            }
        } else {
            responseData.addError(connectionResponse.error);
            responseData.fieldErrors = connectionResponse.fieldErrors;
        }

        // Return a snapshot of the site preferences
        responseData.results.preferences = SitePreferences.getSnapshot();
        SGHelpers.sendJSON(200, responseData);
    } catch (error) {
        responseData.addError(error);
        SGHelpers.sendJSON(500, responseData);
    }
}

/**
 * @description Remove the tokens for the specified environment
 */
function DeauthenticateOutbound() {
    var ResponseData = require('*/cartridge/models/shift4/responseData');
    var SetupHelpers = require('*/cartridge/scripts/shift4SetupHelpers');
    var SitePreferences = require('*/cartridge/scripts/shift4/preferences');
    var SGHelpers = require('*/cartridge/scripts/shift4/helpers/sg');
    var responseData = new ResponseData();
    try {
        // Parse request body
        var requestBodyJson = request.httpParameterMap.getRequestBodyAsString();
        if (null == requestBodyJson) {
            SGHelpers.sendJSON(400, responseData);
            return;
        }
        var requestBody = JSON.parse(requestBodyJson);

        var mode = requestBody.isLiveMode ? 'live' : 'test';
        SitePreferences.put('shift4payments__' + mode + 'PublicKey', '');
        SitePreferences.put('shift4payments__' + mode + 'SecretKey', '');
        SitePreferences.commit();

        // Return a snapshot of the site preferences
        responseData.results.preferences = SitePreferences.getSnapshot();

        var paymentProcessorState = SetupHelpers.getPaymentProcessorState();
        if (SitePreferences.isLiveMode() === requestBody.isLiveMode) {
            responseData.addWarning('The integration is now disconnected.');
        } else if (paymentProcessorState.isEnabled) {
            var connectionResponse = SetupHelpers.testOutboundConnection(SitePreferences.isLiveMode());
            if (!connectionResponse.results.isConnected) {
                responseData.addWarning(connectionResponse.error);
            }
        } else if (paymentProcessorState.disabledPaymentMethods.length) {
            responseData.addWarning(
                SetupHelpers.getDisabledPaymentMethodsWarning(paymentProcessorState.disabledPaymentMethods)
            );
        }

        SGHelpers.sendJSON(200, responseData);
    } catch (error) {
        responseData.addError(error);
        SGHelpers.sendJSON(500, responseData);
    }
}

// Expose api methods guarded behind https and method restrictions
var Guard = require('*/cartridge/scripts/bm_guard');
module.exports.Show = Guard.ensure(['https', 'get'], Show);
module.exports.Save = Guard.ensure(['https', 'post'], Save);
module.exports.AuthenticateOutbound = Guard.ensure(['https', 'post'], AuthenticateOutbound);
module.exports.DeauthenticateOutbound = Guard.ensure(['https', 'post'], DeauthenticateOutbound);
