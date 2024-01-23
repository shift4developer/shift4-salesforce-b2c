'use strict';

module.exports.getLogger = function (name) {
    return {
        debug: (...args) => console.debug(args),
        info: (...args) => console.info(args),
        warn: (...args) => console.warn(args),
        error: (...args) => console.debug(args)
    };
};
