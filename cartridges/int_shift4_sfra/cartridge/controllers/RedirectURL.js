'use strict';

/**
 * @namespace RedirectURL
 */

var server = require('server');
server.extend(module.superModule);

/**
 * @name RedirectURL-Start
 * @description Shift4 override for Apple Pay domain association file. Otherwise, redirect as usual
 * @param {SfraRequest} req - The request object
 * @param {SfraResponse} res - The response object
 * @param {function} next - The next middleware function in the pipeline
 */
server.replace('Start', function (req, res, next) {
    var URLRedirectMgr = require('dw/web/URLRedirectMgr');

    /**
     * --------------------
     * SHIFT4 CHANGES BEGIN
     */
    var ApplePayHelpers = require('*/cartridge/scripts/shift4/helpers/applepay');
    if (ApplePayHelpers.canRedirectToApplePayVerificationFile(URLRedirectMgr.getRedirectOrigin())) {
        res.render('extensions/data', { data: ApplePayHelpers.fetchApplePayVerificationString() });
        return next();
    }
    /**
     * SHIFT4 CHANGES END
     * ------------------
     */

    var redirect = URLRedirectMgr.redirect;
    var location = redirect ? redirect.location : null;
    var redirectStatus = redirect ? redirect.getStatus() : null;

    if (!location) {
        res.setStatusCode(404);
        res.render('error/notFound');
    } else {
        if (redirectStatus) {
            res.setRedirectStatus(redirectStatus);
        }
        res.redirect(location);
    }

    next();
});

module.exports = server.exports();
