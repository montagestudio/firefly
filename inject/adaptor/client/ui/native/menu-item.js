/* global lumieres */
/**
 @module native-menu
 @requires montage/core/core
 @requires montage/core/event/event-manager
 */

var Montage = require("montage/core/core").Montage,
    Promise = require("montage/core/promise").Promise,
    defaultEventManager = require("montage/core/event/event-manager").defaultEventManager;

var kListenerError = "'menuAction' listener must be installed on a component or the Application object";

exports.MenuItem = Montage.create(Montage, {

    _title: {
        value: null
    },

    title: {
        get: function() {
            return this._title;
        },

        set: function(value) {
            this._title = value;
            if (this.menu && !this._nativeLock) {
                lumieres.MenuItem.setTitle.call(this, value);
            }
        }
    },

    setTitle: {
        // needed in order to be compatible with the lumieres implememtation
        enumerable: false,
        value: function(value) {
            this.title = value;
        }
    },


    _menu: {
        value: null
    },

    menu: {
        get: function() {
            return this._menu;
        },

        set: function(value) {
            // Only Lumieres is allow to set the menu property
            if (this._nativeLock) {
                this._menu = value;
            }
        }
    },

    _keyEquivalent: {
        value: ""
    },

    keyEquivalent: {
        get: function() {
            return this._keyEquivalent;
        },

        set: function(value) {
            this._keyEquivalent = value;
        }
    },

    _enabled: {
        value: true
    },

    enabled: {
        get: function() {
            return this._enabled;
        },

        set: function(value) {
            this._enabled = value;
        }
    },

    _isSeparator: {
        value: false
    },

    isSeparator: {
        get: function() {
            return this._isSeparator;
        },

        set: function(value) {
            // can only be set when the menu item has not yet been inserted
            if (this._nativeLock || !this.menu) {
                this._menu = value;
            }
        }
    },

    location: {
        value: null
    },

    insertItem: {
        value: function(item, index) {
            var deferredInsert = Promise.defer();

            // TODO implement this
            // lumieres.MenuItem.insertItem.call(this, item, index, function(error, item) {
            deferredInsert.resolve(item);

            return deferredInsert.promise;
        }
    },

    removeItem: {
        value: function(item) {
            var deferredRemove = Promise.defer();

            //TODO implement this
            // lumieres.MenuItem.removeItem.call(this, item, function(error, item) {
            deferredRemove.resolve(item);

            return deferredRemove.promise;
        }
    },

    deserializedFromSerialization: {
        value: function() {
            if (!this.hasOwnProperty("identifier")) {
                this.identifier = Montage.getInfoForObject(this).label;
            }
        }
    },

    addEventListener: {
        value: function(type, listener, useCapture) {
            throw new Error("addEventListener not supported. " + kListenerError);
        }
    },

    removeEventListener: {
        value: function(type, listener, useCapture) {
            throw new Error("removeEventListener not supported. " + kListenerError);
        }
    },

    dispatchMenuEvent:{
        value: function(type) {
            var event = new CustomEvent(type, {
                    detail: this,
                    bubbles: true,
                    cancelable: true
                });

            defaultEventManager.activeTarget.dispatchEvent(event);

            return event.defaultPrevented;
        }
    }

});
