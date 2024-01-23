'use strict';
/* MOCK */

module.exports.begin = jest.fn();
module.exports.commit = jest.fn();
module.exports.wrap = jest.fn((callback) => callback());
