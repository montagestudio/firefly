/**
 @module native-menu
 @requires montage/core/core
 @requires montage/core/promise
 @requires montage/core/event/mutable-event
 @requires montage/core/event/event-manager
 */

var Montage = require("montage/core/core").Montage,
    Promise = require("montage/core/promise").Promise,
    MenuItem = require("./menu-item").MenuItem;

var kListenerError = "'menuAction' listener must be installed on a component or the Application object";

var Menu = exports.Menu = Montage.specialize({

    _itemsToInsert: {
        value: []
    },

    itemsToInsert: {
        set: function(newItems) {
            var thisRef = this;

            // Generate an identifier if not is specified
            newItems.forEach(function (item) {
                if (typeof item.identifier !== "string" || 0 === item.identifier.length) {
                    item.identifier = item.title || (item.location ? (item.location.after || item.location.before) : "");
                    item.identifier = item.identifier.replace(/ /g, "");
                }
            });

            thisRef._itemsToInsert = thisRef._itemsToInsert.concat(newItems);
            if (!thisRef._fetchingMenu) {
                var itemsBeingInserted = thisRef._itemsToInsert.splice(0),
                    mainMenu = thisRef._items[0].menu;

                thisRef._insertItem(mainMenu, itemsBeingInserted, 0, function() {
                    thisRef._items = mainMenu.items;
                });
            }
        }
    },

    _items: {
        value: null
    },

    _itemsDeferPromises: {
        value: []
    },

    items: {
        get: function() {
            return this._items;
        }
    },

    getMainMenu: {
        value: function() {
            var defer = Promise.defer();
            if (!this._fetchingMenu) {
                defer.resolve(this);
            } else {
                this._itemsDeferPromises.push(defer);
            }
            return defer.promise;
        }
    },

    _fetchMainMenu: {
        value: function() {
            var thisRef = this,
//                getMainMenu = Promise.nfbind(lumieres.getMainMenu);
                getMainMenu = function () {
                    Promise.resolve(null);
                };

            thisRef._fetchingMenu = true;
            getMainMenu().then(function(mainMenu) {
                thisRef._items = mainMenu.items;
                if (thisRef._itemsToInsert.length) {
                    var itemsBeingInserted = thisRef._itemsToInsert.splice(0);
                    thisRef._insertItem(mainMenu, itemsBeingInserted, 0, function() {
                        thisRef._items = mainMenu.items;
                    });
                }
            }).done(function() {
                thisRef._itemsDeferPromises.forEach(function(defer) {
                    defer.resolve(thisRef);
                });
                delete thisRef._fetchingMenu;
            });
        }
    },

    constructor: {
        value: function Menu() {
            this.super();
            var thisRef = this;

            if (typeof lumieres !== "undefined") {
                // Replace the lumieres MenuItem object by our own Montage Equivalent
                if (lumieres.MenuItem === undefined) {
                    lumieres.MenuItem = window.MenuItem;
                    window.MenuItem = MenuItem;

                    Object.defineProperty(MenuItem, "doAction", {
                        value: lumieres.MenuItem.doAction
                    });

                    Object.defineProperty(MenuItem, "doValidate", {
                        value: lumieres.MenuItem.doValidate
                    });
                }

                thisRef._fetchMainMenu();
            } else {
//                throw new Error("the Native Menu component can only be use in conjunction with Lumieres");
            }

            window.addEventListener("didBecomeKey", this);
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

    _deleteCallbackCount: {
        value: 0
    },

    insertItem: {
        value: function(item, index) {
            var deferredInsert = Promise.defer();

//            lumieres.MenuItem.insertItem.call(this, item, index, function(error, item) {
//                if (!error) {
//                    deferredInsert.resolve(item);
//                } else {
//                    deferredInsert.resolve(null);
//                }
//            });
            // TODO implement this
            deferredInsert.resolve(item);

            return deferredInsert.promise;
        }
    },

    removeItem: {
        value: function(item) {
            var deferredRemove = Promise.defer();

//            lumieres.MenuItem.removeItem.call(this, item, function(error, item) {
//                if (!error) {
//                    deferredRemove.resolve(item);
//                } else {
//                    deferredRemove.resolve(null);
//                }
//            });
            // TODO implement this
            deferredRemove.resolve(item);

            return deferredRemove.promise;
        }
    },

    resetMenu: {
        value: function(menu) {
            var thisRef = this;
            var deferredReset = Promise.defer();

            var _reset = function(item) {
                if (item.isJavascriptOwned && item.menu) {
                    if (lumieres) {
                        thisRef._deleteCallbackCount ++;
                        lumieres.MenuItem.removeItem.call(item.menu, item, function() {
                            thisRef._deleteCallbackCount --;
                            if (0 === thisRef._deleteCallbackCount) {
                                thisRef._deleteCallbackCount --; // To prevent firing the callback more than once
                                deferredReset.resolve(menu);
                            }
                        });
                    }

                } else if (item.items) {
                    item.items.forEach(function (childItem) {
                        _reset(childItem);
                    });
                }
            };

            if (!menu) {
                menu = thisRef._items[0].menu;
                if (menu) {
                    _reset(menu);
                }
            } else {
                _reset(menu);
            }

            // Fire the callback when there was no items to delete at all
            if (0 === thisRef._deleteCallbackCount) {
                deferredReset.resolve(menu);
            }

            return deferredReset.promise;
        }
    },

    _locationForPath: {
        value: function(mainMenu, path, isAfter) {
            var menu = mainMenu,
                index = null,
                paths = path.split("."),
                nbrPath = paths.length,
                i;

            var nativeItemAtIndex = function(menu, index) {
                var iItem,
                    i;

                for (i = 0; (iItem = menu.items[i]); i++) {
                    if (iItem.isJavascriptOwned) {
                        continue;
                    }

                    if (-- index === 0) {
                        return { menu: iItem, index: parseInt(i, 10) };
                    }
                }

                return { menu: null, index: -1 };
            };

            // Path are relative to native menus, ignore all JS menus
            for (i = 0; i < nbrPath; i ++) {
                var location = nativeItemAtIndex(menu,  parseInt(paths[i], 10)),
                    nextMenu = location.menu;

                index = location.index;
                if (nextMenu) {
                    menu = nextMenu;
                } else {
                    isAfter = true;
                    index = menu.items.length - 1;
                    break;
                }
            }

            return {
                menu: menu !== mainMenu ? menu.menu : mainMenu,
                index: null ? null : isAfter ? index + 1 : index
            };
        }
    },

    _insertItem: {
        value: function(mainMenu, items, itemIndex, callback) {
            var thisRef = this,
                location,
                index,
                menu,
                item;

            if (itemIndex < items.length) {
                item = items[itemIndex];
                location = item.location;

                menu = mainMenu;
                index = null;

                if (typeof location === "object") {
                    if (location.before !== undefined) {
                        location = thisRef._locationForPath(mainMenu, location.before, false);
                        menu = location.menu;
                        index = location.index;
                    } else if (location.after !== undefined) {
                        location = thisRef._locationForPath(mainMenu, location.after, true);
                        menu = location.menu;
                        index = location.index;
                    }
                }

                //TODO implement this
//                lumieres.MenuItem.insertItem.call(menu, item, index, function() {
//                    thisRef._insertItem(mainMenu, items, ++ itemIndex, callback);
//                });
            } else if (callback) {
                callback(0, null);
            }
        }
    },

    handleDidBecomeKey: {
        value: function(event) {
            this._fetchMainMenu();
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
    }
});

var _defaultMenu = null;
Montage.defineProperty(exports, "defaultMenu", {
    get: function() {
        if (!_defaultMenu) {
            _defaultMenu = Menu.create();
        }
        return _defaultMenu;
    }
});
