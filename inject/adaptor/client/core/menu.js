/**
 @module native-menu
 @requires montage/core/core
 @requires montage/core/promise
 @requires montage/core/event/mutable-event
 @requires montage/core/event/event-manager
 */

var Montage = require("montage/core/core").Montage,
    Promise = require("montage/core/promise").Promise,
    MenuItemModule = require("./menu-item");

var kListenerError = "'menuAction' listener must be installed on a component or the Application object";

var Menu = exports.Menu = Montage.specialize({

    constructor: {
        value: function Menu() {
            this.super();

            this._items = [];
        }
    },

    reset: {
        value: function(menu) {
            this.dispatchBeforeOwnPropertyChange("items", this._items);
            this._items = [];
            this.dispatchOwnPropertyChange("items", this._items);
            return Promise.resolve();
        }
    },

    _items: {
        value: null
    },

    items: {
        get: function() {
            return this._items;
        }
    },

    insertItem: {
        value: function(item, index) {
            this.items.splice(index, 0, item);
            return Promise.resolve(item);
        }
    },

    removeItem: {
        value: function(item) {
            var deferredRemove = Promise.defer();

            var index = this.items.indexOf(item);

            if (index > -1) {
                index.splice(index, 1);
                deferredRemove.resolve(item);
            } else {
                deferredRemove.reject(new Error("Cannot remove item that is not in this menu"));
            }

            return deferredRemove.promise;
        }
    },

    menuItemForIdentifier: {
        value: function(identifier) {
            var searchItemsTree = function(menu, identifier) {
                var iItem,
                    i;

                if (menu && menu.items) {
                    for (i = 0; (iItem = menu.items[i]); i++) {
                        if (iItem.identifier === identifier) {
                            return iItem;
                        } else {
                            if (iItem.items) {
                                iItem = searchItemsTree(iItem, identifier);
                                if (iItem) {
                                    return iItem;
                                }
                            }
                        }
                    }
                }

                return;
            };

            return searchItemsTree(this, identifier);
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

var _defaultMenu = null;
Montage.defineProperty(exports, "defaultMenu", {
    get: function() {
        if (!_defaultMenu) {
            _defaultMenu = new Menu();

            //TODO clean up this whole initialization
            Promise.nextTick(function () {
                var undoMenuItem = new MenuItemModule.MenuItem(),
                    redoMenuItem = new MenuItemModule.MenuItem(),
                    saveMenuItem = new MenuItemModule.MenuItem();

                undoMenuItem.title = "Undo";
                undoMenuItem.identifier = "undo";

                redoMenuItem.title = "Redo";
                redoMenuItem.identifier = "redo";

                saveMenuItem.title = "Save";
                saveMenuItem.identifier = "save";
                saveMenuItem.keyEquivalent = "command+s";

                _defaultMenu.insertItem(saveMenuItem).done();
                _defaultMenu.insertItem(undoMenuItem).done();
                _defaultMenu.insertItem(redoMenuItem).done();
            });
        }
        return _defaultMenu;
    }
});
