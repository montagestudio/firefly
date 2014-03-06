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
var _userMenu = null;

function makeMenuItem (title, identifier, enabled, keyEquivalent, items) {
    var menuItem = new MenuItemModule.MenuItem();

    menuItem.title = title;
    menuItem.identifier = identifier;
    menuItem.enabled = enabled;
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
                var projectMenu,
                    editMenu,
                    viewMenu,
                    helpMenu,
                    newSubMenu;

                // Help
                helpMenu = makeMenuItem("Help", "", true, "", [
                    makeMenuItem("Documentation", "documentation", true, ""),
                    makeMenuItem("Forum", "forum", true, ""),
                    makeMenuItem("Report a Bug", true, "report", ""),
                    makeMenuItem("API", "api", true, ""),
                    makeMenuItem("Framework", "framework", true, "")
                ]);
                _defaultMenu.insertItem(helpMenu);

                // View
                viewMenu = makeMenuItem("View", "", true, "", [
                    makeMenuItem("Launch Preview", "launchPreview", true, "control+r")
                ]);
                _defaultMenu.insertItem(viewMenu);

                // Edit
                editMenu = makeMenuItem("Edit", "", true, "", [
                    makeMenuItem("Undo", "undo", false, "control+z"),
                    makeMenuItem("Redo", "redo", false, "control+shift+z"),
                    makeMenuItem("Delete", "delete", false, "command+backspace")
                ]);
                _defaultMenu.insertItem(editMenu);

                // File
                newSubMenu = makeMenuItem("New", "new", true, "", [
                    makeMenuItem("Application", "newApplication", false, "control+n"),
                    makeMenuItem("Component", "newComponent", true, "shift+control+n"),
                    makeMenuItem("Module", "newModule", true, "")
                ]);

                projectMenu = makeMenuItem("Project", "", true, "", [
                    newSubMenu,
                    makeMenuItem("Save", "save", true, "command+s"),
                    makeMenuItem("Source", "source", true, "")
                ]);
                _defaultMenu.insertItem(projectMenu);
            });
        }
        return _defaultMenu;
    }
});

Montage.defineProperty(exports, "userMenu", {
    get: function() {
        if (!_userMenu) {
            _userMenu = new Menu();
            var userMenuItem = makeMenuItem("", "", true, "", [
                    makeMenuItem("Logout", "logout", true, "")
                ]);

            _userMenu.insertItem(userMenuItem);
        }
        return _userMenu;
    }
});
