'use strict';

/**
 * @typedef {{message?: string, warning?: string, [key]: any}} ResponseDataResults
 */

/**
 * @typedef {object} ResponseData
 * @property {boolean} isSuccess
 * @property {ResponseDataResults} results
 * @property {string?} error
 * @property {string?} stack
 */

/**
 * @description Handles user interaction with the setup wizard and sends updates back to the controller methods on the back-end
 * @author @jackwk99
 * @version 1.0.0
 */
class Shift4Setup extends Shift4Component {
    /**
     * ----------------------------------------------
     *              TRACKED PROPERTIES
     * ----------------------------------------------
     */

    state = {
        isLoading: true,
        isSaving: false,
        isAuthenticating: '',
        liveModeIsConnected: false,
        testModeIsConnected: false,
        preferences: {},
        warning: '',
        error: ''
    };

    /**
     * ----------------------------------------------
     *              GENERIC PROPERTIES
     * ----------------------------------------------
     */

    updateTimeout;

    /**
     * ----------------------------------------------
     *               CALCULATED GETTERS
     * ----------------------------------------------
     */

    get template() {
        return document.getElementById('shift4_setup');
    }

    get spinner() {
        return this.template.querySelector('#shift4_spinner');
    }

    get inputs() {
        return Array.from(this.template.querySelectorAll('input[id^=shift4payments__]')).concat(
            Array.from(this.template.querySelectorAll('button[id^=shift4payments__]'))
        );
    }

    get errorBanner() {
        return this.template.querySelector('#shift4_error');
    }

    get warningBanner() {
        return this.template.querySelector('#shift4_warning');
    }

    get settingsBox() {
        return this.template.querySelectorAll('.shift4-settings-box input');
    }

    get settingsBoxButtons() {
        return this.template.querySelectorAll('.shift4-settings-box button');
    }

    get liveModeAuthButton() {
        return this.template.querySelector('button#shift4_liveModeAuth');
    }

    get liveModeConnectorStatus() {
        return this.template.querySelector('#shift4_liveConnectorStatus');
    }

    get testModeAuthButton() {
        return this.template.querySelector('button#shift4_testModeAuth');
    }

    get testModeConnectorStatus() {
        return this.template.querySelector('#shift4_testConnectorStatus');
    }

    get inputsAreDisabled() {
        return this.state.isLoading || this.state.isSaving;
    }

    /**
     * ------------------------------------------
     *            COMPONENT LIFECYCLE
     * ------------------------------------------
     */

    connectedCallback() {
        // If response data is unavailable, the component cant load.
        if (typeof pageResponseData !== 'object' || !pageResponseData) {
            this.state.error = `Response data is unavailable. Setup Assistant is unable to load.
                          Please ensure your cartridge path includes "int_shift4", then reload the page.
                          If the problem persists, contact supports.`;
            return this.render();
        }
        if (pageResponseData.results) {
            this.savedPreferences = JSON.parse(JSON.stringify(pageResponseData.results.preferences ?? {}));
            this.state.preferences = pageResponseData.results.preferences ?? {};
            this.state.liveModeIsConnected = pageResponseData.results.liveModeIsConnected;
            this.state.testModeIsConnected = pageResponseData.results.testModeIsConnected;
            this.urls = pageResponseData.results.urls;
        }
        if (pageResponseData.results.warning) {
            this.state.warning = pageResponseData.results.warning;
        }
        if (!pageResponseData.isSuccess) {
            this.state.error = pageResponseData.error;
        }
        this.state.isLoading = false;
    }

    /**
     * @description Align the UI with the state of the component
     */
    renderedCallback() {
        // Show spinner if page is loading
        if (this.state.isLoading) {
            this.spinner?.classList.remove('slds-hide');
        } else {
            this.spinner?.classList.add('slds-hide');
        }

        // Show an error if there is one
        if (this.state.error?.length) {
            this.errorBanner.classList.remove('slds-hide');
            this.errorBanner.querySelector('h2').innerHTML = this.state.error;
        } else {
            this.errorBanner.classList.add('slds-hide');
        }

        // Show a warning if there is one
        if (this.state.warning?.length) {
            this.warningBanner.classList.remove('slds-hide');
            this.warningBanner.querySelector('h2').innerHTML = this.state.warning;
        } else {
            this.warningBanner.classList.add('slds-hide');
        }

        // Update html input fields with their associated tracked value and disable them is the preferences are currently saving
        this.inputs.forEach((input) => {
            if ('checkbox' === input.type) {
                input.checked = !!this.state.preferences[input.id];
                input.disabled = this.inputsAreDisabled;
            } else if ('radio' === input.type) {
                input.disabled = this.inputsAreDisabled;
                input.checked = this.state.preferences[input.name] === input.value;
            } else {
                input.disabled = this.inputsAreDisabled;
                if (this.state.preferences.hasOwnProperty(input.id)) {
                    input.value = this.state.preferences[input.id];
                }
            }
        });

        this.setConnectionStatus('live');
        this.setConnectionStatus('test');

        this.template.querySelector('#shift4_apply').disabled = this.inputsAreDisabled || null == this.getChanges();
    }

    setConnectionStatus(mode) {
        const isConnected = this.state[`${mode}ModeIsConnected`];
        const isLoading = this.state.isAuthenticating === mode;
        const connector = this.template.querySelector(`#shift4_${mode}ConnectorStatus`);
        const authButton = this.template.querySelector(`button#shift4_${mode}ModeAuth`);
        const authIcon = connector.querySelector(`#${mode}AuthIcon`);
        const authAssist = connector.querySelector(`#${mode}AuthAssist`);
        const authLabel = connector.querySelector(`#${mode}AuthLabel`);
        const pkInput = this.template.querySelector(`#shift4payments__${mode}PublicKey`);
        const skInput = this.template.querySelector(`#shift4payments__${mode}SecretKey`);
        const authState = {
            status: isConnected ? 'Connected' : 'Not Connected',
            button: {
                label: isConnected ? 'Disconnect' : 'Connect',
                className: 'slds-button ' + (isConnected ? 'slds-button_text-destructive' : 'slds-button_outline-brand')
            },
            icon: {
                name: isConnected ? 'success' : 'ban',
                className:
                    'slds-icon_container slds-m-right_x-small ' +
                    (isConnected
                        ? 'slds-icon-utility-success shift4-authorized'
                        : 'slds-icon-utility-ban shift4-not-authorized')
            }
        };
        pkInput.disabled = this.inputsAreDisabled || isConnected || isLoading;
        skInput.disabled = this.inputsAreDisabled || isConnected || isLoading;
        authButton.innerText = authState.button.label;
        authButton.className = authState.button.className;
        authButton.disabled = this.inputsAreDisabled || isLoading;
        authAssist.innerText = authState.status;
        authLabel.innerText = authState.status;
        connector.title = authState.status;
        authIcon.className = authState.icon.className;
        authIcon.querySelector('use').setAttribute('href', `${this.urls.symbols}#${authState.icon.name}`);
    }

    getKeyFieldError(mode, type) {
        return `The ${mode} mode secret key must begin with "${type}k_${mode}_" and contain at least 32 characters.`;
    }

    /**
     * ----------------------------------------------
     *                BACKEND CALLOUTS
     * ----------------------------------------------
     */

    savePreferences() {
        const changes = this.getChanges();
        if (!changes) {
            return;
        }
        this.state.isSaving = true;
        return utils
            .post(this.urls.save, changes)
            .then((rd) => {
                const results = utils.handleResponseData(rd);
                this.state.preferences = results.preferences;
                this.savedPreferences = JSON.parse(JSON.stringify(results.preferences));
                this.state.warning = results.warning;
                this.clearInputErrors();
            })
            .catch((error) => {
                this.state.preferences = JSON.parse(JSON.stringify(this.savedPreferences));
                this.state.error = utils.getErrorMessage(error);
            })
            .finally(() => {
                this.state.isSaving = false;
            });
    }

    /**
     * @description Pass the public and secret keys for the specified environment to be verified and saved down
     * @param {string} mode Either "live" or "test"
     * @returns {Promise}
     */
    async authenticate(mode) {
        if (this.state[`${mode}ModeIsConnected`]) {
            return;
        }
        this.state.isAuthenticating = mode;
        const requestBody = {
            isLiveMode: mode === 'live',
            publicKey: this.state.preferences[`shift4payments__${mode}PublicKey`],
            secretKey: this.state.preferences[`shift4payments__${mode}SecretKey`]
        };
        return utils
            .post(this.urls.authenticate, requestBody)
            .then((rd) => {
                const results = utils.handleResponseData(rd);
                this.state[`${mode}ModeIsConnected`] = true;
                this.state.preferences = results.preferences;
                this.savedPreferences = JSON.parse(JSON.stringify(results.preferences));
                this.state.warning = results.warning;
                this.clearInputErrors();
            })
            .catch((error) => {
                if (error.fieldErrors) {
                    error.fieldErrors.forEach((fieldError) => {
                        const input = this.template.querySelector(`#${fieldError.fieldName}`);
                        if (input) {
                            this.setCustomValidity(input, fieldError.error);
                        }
                    });
                } else {
                    this.state.error = utils.getErrorMessage(error);
                }
            })
            .finally(() => {
                this.state.isAuthenticating = null;
            });
    }

    /**
     * @description Delete the public and secret key for the specified environment
     * @param {string} mode Either "live" or "test"
     * @returns {Promise}
     */
    async deauthenticate(mode) {
        if (!this.state[`${mode}ModeIsConnected`]) {
            return;
        }
        this.state.isAuthenticating = mode;
        const requestBody = {
            isLiveMode: mode === 'live'
        };
        return utils
            .post(this.urls.deauthenticate, requestBody)
            .then((rd) => {
                const results = utils.handleResponseData(rd);
                this.state[`${mode}ModeIsConnected`] = false;
                this.state.preferences = results.preferences;
                this.savedPreferences = JSON.parse(JSON.stringify(results.preferences));
                this.state.warning = results.warning;
                this.clearInputErrors();
            })
            .catch((error) => {
                this.state.error = utils.getErrorMessage(error);
            })
            .finally(() => {
                this.state.isAuthenticating = null;
            });
    }

    /**
     * ----------------------------------------------
     *               STATE HELPERS
     * ----------------------------------------------
     */

    /**
     * @description Return a diff of the preferences shown in the UI vs the saved preferences
     * @returns {object | null} - If there are changes, they are returned, else null
     */
    getChanges() {
        const changes = {};
        for (const fieldName of Object.keys(this.state.preferences)) {
            if (/(live|test)(Public|Secret)Key/.test(fieldName)) {
                continue;
            }
            if (this.state.preferences[fieldName] !== this.savedPreferences[fieldName]) {
                changes[fieldName] = this.state.preferences[fieldName];
            }
        }
        if (Object.keys(changes).length) {
            return changes;
        }
        return null;
    }

    /**
     * @description Set a preference key/value pair. This will trigger a re-render
     * @param {string} key
     * @param {any} value
     */
    setPreferenceValue(key, value) {
        this.state.preferences = {
            ...this.state.preferences,
            [key]: value
        };
    }

    /**
     * ----------------------------------------------
     *                  UI HELPERS
     * ----------------------------------------------
     */

    clearInputErrors() {
        this.inputs.forEach((input) => {
            if (input.type === 'text') {
                this.setCustomValidity(input, '');
            }
        });
    }

    /**
     *
     * @param {HTMLElement} component
     * @param {string} message
     */
    setCustomValidity(component, message) {
        if (message?.length) {
            component.classList.add('slds-has-error');
            if (component.nextElementSibling) {
                component.nextElementSibling.innerText = message;
                component.nextElementSibling.classList.remove('slds-hide');
            }
        } else {
            component.classList.remove('slds-has-error');
            if (component.nextElementSibling) {
                component.nextElementSibling.classList.add('slds-hide');
            }
        }
    }

    /**
     * ----------------------------------------------
     *               EVENT LISTENERS
     * ----------------------------------------------
     */

    handleCloseError() {
        this.state.error = '';
    }

    handleCloseWarning() {
        this.state.warning = '';
    }

    /**
     * @description Select all text in an input field when it is focused
     * @param {Event} event
     */
    handleFocusSelectText(event) {
        event.currentTarget.selectionStart = 0;
        event.currentTarget.selectionEnd = event.currentTarget.value.length;
    }

    /**
     * @description Update a text preference value
     * @param {Event} event
     */
    handleChangeText(event) {
        this.setPreferenceValue(event.currentTarget.id, event.currentTarget.value);
        if (event.currentTarget.checkValidity()) {
            this.setCustomValidity(event.currentTarget, '');
        } else {
            const mode = event.currentTarget.dataset.mode;
            const type = event.currentTarget.dataset.type;
            this.setCustomValidity(event.currentTarget, this.getKeyFieldError(mode, type));
        }
    }

    /**
     * @description Change a radio button group value
     * @param {Event} event
     */
    handleChangeRadio(event) {
        this.setPreferenceValue(event.currentTarget.name, event.currentTarget.value);
    }

    /**
     * @description Update a toggle value
     * @param {Event} event
     */
    handleClickCheckbox(event) {
        this.setPreferenceValue(event.currentTarget.id, !!event.currentTarget.checked);
    }

    /**
     * @description If the envrionment is connected, confirm the disconnect. Else validate input & attempt to authenticate with input
     * @param {Event} event
     */
    handleClickAuthButton(event) {
        const mode = event.currentTarget.dataset.mode;
        if (this.state[`${mode}ModeIsConnected`]) {
            const confirmationBox = this.template.querySelector(`#shift4_${mode}DisconnectConfirmationBox`);
            confirmationBox.classList.remove('slds-hide');
            const confirmationText = confirmationBox.querySelector('p');
            confirmationText.innerText = 'Are you sure you want to disable the integration?';
            event.currentTarget.blur();
            return;
        }
        const pkInput = this.template.querySelector(`#shift4payments__${mode}PublicKey`);
        const skInput = this.template.querySelector(`#shift4payments__${mode}SecretKey`);
        const pkIsValid = pkInput.checkValidity();
        const skIsValid = skInput.checkValidity();
        if (pkIsValid && skIsValid) {
            this.authenticate(mode);
            return;
        }
        if (!pkIsValid) {
            this.setCustomValidity(pkInput, this.getKeyFieldError(mode, 'p'));
        }
        if (!skIsValid) {
            this.setCustomValidity(skInput, this.getKeyFieldError(mode, 's'));
        }
    }

    /**
     * @param {Event} event
     */
    handleCancelDisconnect(event) {
        const mode = event.currentTarget.dataset.mode;
        const confirmationBox = this.template.querySelector(`#shift4_${mode}DisconnectConfirmationBox`);
        confirmationBox.classList.add('slds-hide');
    }

    /**
     * @param {Event} event
     */
    handleConfirmDisconnect(event) {
        const mode = event.currentTarget.dataset.mode;
        const confirmationBox = this.template.querySelector(`#shift4_${mode}DisconnectConfirmationBox`);
        confirmationBox.classList.add('slds-hide');
        this.deauthenticate(mode);
    }

    /**
     * @description If changes were made when the user clicks the save button, callout to the backend to save the preference value
     */
    handleClickApply() {
        this.savePreferences();
    }
}

// Instantiate the setup wizard
try {
    window.shift4Setup = new Shift4Setup();
} catch (error) {
    console.error('Failed to initialize setup', error);
}
