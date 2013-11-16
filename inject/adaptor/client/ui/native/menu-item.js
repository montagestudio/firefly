/**
 @module native-menu
 @requires montage/core/core
 @requires montage/core/event/event-manager
 */

var Montage = require("montage/core/core").Montage,
    Promise = require("montage/core/promise").Promise,
    defaultEventManager = require("montage/core/event/event-manager").defaultEventManager,
    MenuModule = require("./menu");

var kListenerError = "'menuAction' listener must be installed on a component or the Application object";

exports.MenuItem = Montage.specialize({

    deserializedFromSerialization: {
        value: function() {
            if (!this.hasOwnProperty("identifier")) {
                this.identifier = Montage.getInfoForObject(this).label;
            }
        }
    },

    constructor: {
        value: function MenuItem () {
            this.super();
        }
    },

    title: {
        value: null
    },

    keyEquivalent: {
        value: ""
    },

    enabled: {
        value: true
    },

    isSeparator: {
        value: false
    },

    _menu: {
        value: null
    },

    insertItem: {
        value: function(item, index) {
            if (!this.menu) {
                this._menu = new MenuModule.Menu();
            }

            return this._menu.insertItem(item, index);
        }
    },

    removeItem: {
        value: function(item) {
            var deferredRemove = Promise.defer();

            if (!this.menu) {
                deferredRemove.reject(new Error("Cannot remove item from empty menu"));
            } else {
                deferredRemove = this._menu.removeItem(item);
            }

            return deferredRemove.promise;
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
    },

    addEventListener: {
        value: function() {
            throw new Error("addEventListener not supported. " + kListenerError);
        }
    },

    removeEventListener: {
        value: function() {
            throw new Error("removeEventListener not supported. " + kListenerError);
        }
    }

});
