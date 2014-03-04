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

function makeMenuItem (title, identifier, keyEquivalent, items) {
    var menuItem = new MenuItemModule.MenuItem();

    menuItem.title = title;
    menuItem.identifier = identifier;
    menuItem.keyEquivalent = keyEquivalent;
    if (items) {
        menuItem.items = items;
    }

    return menuItem;
}

Montage.defineProperty(exports, "defaultMenu", {
    get: function() {
        if (!_defaultMenu) {
            _defaultMenu = new Menu();

            //TODO clean up this whole initialization
            Promise.nextTick(function () {
                var fileMenu,
                    editMenu,
                    viewMenu,
                    helpMenu,
                    newSubMenu;

                // Help
                helpMenu = makeMenuItem("Help", "", "", [
                    makeMenuItem("Documentation", "documentation", ""),
                    makeMenuItem("Forum", "forum", ""),
                    makeMenuItem("Report a Bug", "report", ""),
                    makeMenuItem("API", "api", ""),
                    makeMenuItem("Framework", "framework", "")
                ]);
                _defaultMenu.insertItem(helpMenu);

                // View
                viewMenu = makeMenuItem("View", "", "", [
                    makeMenuItem("Launch Preview", "launchPreview", "control+r")
                ]);
                _defaultMenu.insertItem(viewMenu);

                // Edit
                editMenu = makeMenuItem("Edit", "", "", [
                    makeMenuItem("Undo", "undo", "control+z"),
                    makeMenuItem("Redo", "redo", "control+shift+z"),
                    makeMenuItem("Delete", "delete", "command+backspace")
                ]);
                _defaultMenu.insertItem(editMenu);

                // File
                newSubMenu = makeMenuItem("New", "new", "", [
                    makeMenuItem("Application", "newApplication", "control+n"),
                    makeMenuItem("Component", "newComponent", "shift+control+n"),
                    makeMenuItem("Module", "newModule", "")
                ]);
                fileMenu = makeMenuItem("File", "", "", [
                    newSubMenu,
                    makeMenuItem("Save", "save", "command+s")
                ]);
                _defaultMenu.insertItem(fileMenu);

            });
        }
        return _defaultMenu;
    }
});
