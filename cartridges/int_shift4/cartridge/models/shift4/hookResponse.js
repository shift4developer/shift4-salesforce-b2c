'use strict';

function HookResponse() {
    /** @type {Array<Object<string, string>>} */
    this.fieldErrors = [];

    /** @type {Array<string>} */
    this.serverErrors = [];

    this.error = false;
    this.success = true;

    /**
     * @description Add a field specific error to the hook response
     * @param {string} fieldName The name of the field the error occurred at
     * @param {string} errorMessage The error message to display at the field level
     */
    this.addFieldError = function (fieldName, errorMessage) {
        this.error = true;
        this.success = false;
        var fieldError = {};
        fieldError[fieldName] = errorMessage;
        this.fieldErrors.push(fieldError);
    }.bind(this);

    /**
     * @description Add a server error to the hook response
     * @param {string} serverError Error that occurred during business logic execution
     */
    this.addServerError = function (serverError) {
        this.error = true;
        this.success = false;
        this.serverErrors.push(serverError);
    }.bind(this);
}

module.exports = HookResponse;
