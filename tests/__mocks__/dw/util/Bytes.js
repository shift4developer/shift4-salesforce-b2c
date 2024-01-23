'use strict';
/* MOCK */

class MockBytes {
    str = null;
    constructor(str) {
        this.str = str;
    }
    toString() {
        return this.str;
    }
}

module.exports = MockBytes;
