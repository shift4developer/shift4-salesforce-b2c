'use strict';
/* MOCK */

module.exports.toBase64 = function (bytes) {
    return btoa(bytes.toString());
};
