'use strict';

/**
 * @class
 * @description A super simple framework for creating a reactive front-end
 */
class Shift4Component {
    isConnected = false;

    /**
     * @description Any properties of this object will be tracked and the UI will be refreshed whenever a property is updated
     * @type {object}
     */
    state = {};

    /**
     * @description The root html element for this component
     * @type {HTMLElement}
     */
    get template() {
        if (!this._template?.tagName) {
            this._template = document.getElementById(this.componentName);
            if (!this._template) {
                throw new Error('The root element for this component cannot be found. Please refresh the page.');
            }
        }
        return this._template;
    }

    /**
     * @constructor
     * @param {string} componentName Name of this component used to identify the root html element
     */
    constructor(componentName) {
        this.componentName = componentName;
        setTimeout(() => {
            if (null != this.state && typeof this.state === 'object') {
                Object.keys(this.state).forEach((fieldName) => this.track(this.state, fieldName));
            }
            if (typeof this.connectedCallback === 'function') {
                this.connectedCallback();
            }
            this.isConnected = true;
            this.render();
        }, 0);
    }

    track(object, fieldName) {
        const component = this;
        const initialValue = object[fieldName];
        Object.defineProperty(object, fieldName, {
            get: function () {
                return this[`_${fieldName}`] ?? initialValue;
            },
            set: function (value) {
                this[`_${fieldName}`] = value;
                component.render();
            }
        });
        if (null != initialValue && typeof initialValue === 'object') {
            Object.keys(initialValue).forEach((subFieldName) => this.track(initialValue, subFieldName));
        }
    }

    render() {
        if (!this.isConnected) {
            return;
        }
        if (typeof this.renderedCallback === 'function') {
            this.renderedCallback();
        }
    }
}
