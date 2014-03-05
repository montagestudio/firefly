/*jshint browser:true */
/**
 * @module ui/menu-item.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    KeyComposer = require("montage/composer/key-composer").KeyComposer;

/**
 * @class MenuItem
 * @extends Component
 */
exports.MenuItem = Component.specialize(/** @lends MenuItem# */ {
    constructor: {
        value: function MenuItem() {
            this.super();
        }
    },

    _keyComposer: {
        value: null
    },

    _menuItemModel: {
        value: null
    },

    overlayPosition: {
        value: "down"
    },

    enterDocument: {
        value: function (firstTime) {
            if (!firstTime) { return; }
            this.element.addEventListener("mouseover", this, false);
        }
    },

    menuItemModel: {
        get: function () {
            return this._menuItemModel;
        },
        set: function (value) {
            if (value === this._menuItemModel) {
                return;
            }

            if (this._menuItemModel) {
                throw new Error("MenuItem already associated with a MenuItemModel");
            }

            this._menuItemModel = value;

            if (this._menuItemModel) {
                var keyEquivalent = this._menuItemModel.keyEquivalent;

                if (keyEquivalent) {
                    this._keyComposer = new KeyComposer();
                    this._keyComposer.component = this;
                    this._keyComposer.keys = keyEquivalent;
                    this._keyComposer.identifier = "menuAction";
                    this.addComposer(this._keyComposer);
                    this._keyComposer.element = window;

                    this.addEventListener("keyPress", this, false);
                    this._keyComposer.addEventListener("keyPress", null, false);
                }
            }
        }
    },

    handleKeyPress: {
        value: function(event) {
            if (event.identifier === "menuAction" && this.menuItemModel) {
                //TODO ADD a flashing effect here to give feedback
                this.menuItemModel.dispatchMenuEvent("menuAction");
            }
        }
    },

    //TODO handle menuValidate event

    _showContextualMenu: {
        value: function (element) {
            var menuPositions = element.getBoundingClientRect(),
                contextualMenuPosition;

            if (this.overlayPosition === "down") {
                contextualMenuPosition = {top: menuPositions.bottom, left: menuPositions.left};
            } else {
                contextualMenuPosition = {top: menuPositions.top, left: menuPositions.right};
            }

            if (this.menuItemModel.items && this.menuItemModel.items.length) {
                this.templateObjects.contextualMenu.show(contextualMenuPosition);
            } else {
                this.dispatchEventNamed("dismissContextualMenu");
            }
        }
    },

    _buttonAction: {
        value: function (element) {
            if (!this.menuItemModel) {
                return;
            }
            if (this.menuItemModel.keyEquivalent) {
                this.menuItemModel.dispatchMenuEvent("menuAction");
            } else if (this.menuItemModel.items && this.menuItemModel.items.length) {
                this.menuItemModel.items.forEach(function (item) {
                    item.dispatchMenuEvent("menuValidate");
                });
            }
            this._showContextualMenu(element);
        }
    },

    handleMenuButtonAction: {
        value: function (evt) {
            this._buttonAction(this.templateObjects.menuButton.element);
        }
    },

    isSubMenu: {
        value: function () {
            return (this.menuItemModel && this.menuItemModel.items && this.menuItemModel.items.length && this.overlayPosition === "right");
        }
    },

    handleMouseover: {
        value: function (evt) {
            if (this.isSubMenu()) {
                this._showContextualMenu(this.templateObjects.menuButton.element);
            }
        }
    },

    handleDismissContextualMenu: {
        value: function (evt) {
            this.templateObjects.contextualMenu.hide();
        }
    },

    // To prevent dispatching events from itself, preserve the
    // activeTarget
    // TODO while clever, we might need to actually accept activeTarget for usability
    // and instead store whom to dispatch from once we've "stolen" the activeTarget status
    acceptsActiveTarget: {
        get: function () {
            this.nextTarget = this.eventManager.activeTarget;
            return false;
        }
    },

    draw: {
        value: function () {
            if (this.menuItemModel && this.menuItemModel.keyEquivalent && this.menuItemModel.keyEquivalent.length) {
                this.templateObjects.menuButton.element.dataset.shortcut = this.menuItemModel.keyEquivalent;
            }

            if (this.isSubMenu()) {
                this.templateObjects.menuButton.element.classList.add("subMenu");
            }
        }
    }

});
