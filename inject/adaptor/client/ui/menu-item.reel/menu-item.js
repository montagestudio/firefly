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

    menuFlashing: {
        value: false
    },

    ignoreAction : {
        value: false
    },

    enterDocument: {
        value: function (firstTime) {
            if (!firstTime) { return; }
            this.element.addEventListener("mouseover", this, false);
            this.element.addEventListener("mouseout", this, false);
            this.element.addEventListener("mouseup", this, false);
            this.element.addEventListener("mousedown", this, false);

            this.templateObjects.menuButton.element.addEventListener("mouseleave", this, false);

            if (this.isRootMenu()) {
                this.addEventListener("menuFlashing", this, false);
            }
        }
    },

    isOpen: {
        value: false
    },

    open: {
        value: function (position) {
            var menu = this.menu,
                activePath = menu.activePath;

            this.isOpen = true;
            activePath.push(this);

            this.templateObjects.contextualMenu.show(position);
        }
    },

    _closeActivePathUpdate: {
        value: function () {
            var menu = this.menu,
                activePath = menu.activePath,
                i = activePath.indexOf(this);

            this.isOpen = false;
            if (i > 0) {
                activePath.splice(i, activePath.length - i);
            } else {
                menu.activePath = [];
            }
        }
    },

    close: {
        value: function () {
            this._closeActivePathUpdate();
            this.templateObjects.contextualMenu.hide();
        }
    },

    handleMenuFlashing: {
        value: function (evt) {
            this.menuFlashing = true;
            this.needsDraw = true;
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
                this.dispatchEventNamed("menuFlashing", true, true);
                this.menuItemModel.dispatchMenuEvent("menuAction");
            }
        }
    },

    _toggleContextualMenu: {
        value: function (element) {
            var menuPositions = element.getBoundingClientRect(),
                contextualMenuPosition;

            if (!this.menuItemModel.items || !this.menuItemModel.items.length) {
                return;
            }

            if (this.overlayPosition === "down") {
                contextualMenuPosition = {top: menuPositions.bottom, left: menuPositions.left};
            } else if (this.overlayPosition === "right") {
                contextualMenuPosition = {top: menuPositions.top, left: menuPositions.right};
            } else if (this.overlayPosition === "left") {
                contextualMenuPosition = {top: menuPositions.top, right: menuPositions.left};
            }

            if (!this.isOpen) {
                this.open(contextualMenuPosition);
            } else {
                this.close();
            }
        }
    },

    _openSubmenu: {
        value: function () {
            var element = this.templateObjects.menuButton.element;
            this._toggleContextualMenu(element);

            if (this.isOpen) {
                this.menuItemModel.items.forEach(function (item) {
                    item.dispatchMenuEvent("menuValidate");
                });
            }
        }
    },

    _triggerAction: {
        value: function () {
            this.menuItemModel.dispatchMenuEvent("menuAction");
            this.dispatchEventNamed("dismissContextualMenu", true, false);
        }
    },

    _buttonAction: {
        value: function (element) {
            if (!this.menuItemModel) {
                return;
            }

            if (!this.menuItemModel.items.length) {
                this._triggerAction();
            } else {
                this._openSubmenu();
            }
        }
    },

    handleMenuButtonAction: {
        value: function (evt) {
            evt.stop();
        }
    },

    isSubMenu: {
        value: function () {
            return (this.menuItemModel && this.menuItemModel.items && this.menuItemModel.items.length && !this.isRootMenu());
        }
    },

    isRootMenu: {
        value: function () {
            return (this.parentMenuItem === this);
        }
    },

    handleMouseover: {
        value: function (evt) {
            var activePath = this.menu.activePath;
            evt.stop();

            // CSS's pseudo class hover is not applied durring a drag, this is a workaround [1/2]
            this.templateObjects.menuButton.classList.add("over");

            // Closing sub menus
            if (activePath.length) {
                var parentIndex = activePath.indexOf(this.parentMenuItem);
                for (var i = parentIndex + 1; i < activePath.length; i++) {
                    activePath[i].close();
                }
                activePath.slice(parentIndex, activePath.length);
            }

            // Open a submenu
            if (this.isSubMenu() && !this.templateObjects.contextualMenu.isOpen) {
                this._openSubmenu();
                return;
            }

            // Root menuItem hover act like click if there is already a sub menu open
            if (this.isRootMenu() && activePath.length && this !== activePath[0]) {
                this._buttonAction();
            }
        }
    },

    handleMousedown: {
        value: function (evt) {
            evt.stop();

            if (this.ignoreAction) {
                this.ignoreAction = false;
                return;
            }
            if (this.isSubMenu() || this.isRootMenu()) {
                this._openSubmenu();
            }
        }
    },

    handleMouseup: {
        value: function (evt) {
            if (!this.isSubMenu()) {
                this._triggerAction();
            }
        }
    },

    // Prevent button to wait for the end of the press event to stop being displayed as active
    handleMouseleave: {
        value: function (evt) {
            this.templateObjects.menuButton.active = false;
        }
    },

    handleMouseout: {
        value: function (evt) {
            // CSS's pseudo class hover is not applied durring a drag, this is a workaround [2/2]
            this.templateObjects.menuButton.classList.remove("over");
        }
    },

    // Event fired from a sub-menu asking for it's closure
    // Typical use is to dismiss a menu after firing a menu event
    handleDismissContextualMenu: {
        value: function (evt) {
            this.close();
        }
    },

    // Event fired to informed that the contextMenu is being closed
    // This happens for example, when the overlay loses active target
    handleHideContextualMenu: {
        value: function (evt) {
            this._closeActivePathUpdate();
        }
    },

    // To prevent dispatching events from itself, preserve the
    // activeTarget
    // TODO while clever, we might need to actually accept activeTarget for usability
    // and instead store whom to dispatch from once we've "stolen" the activeTarget status
    acceptsActiveTarget: {
        get: function () {
            if (this.isOpen) {
                this.ignoreAction = true;
            }
            this.nextTarget = this.eventManager.activeTarget;
            return false;
        }
    },

    draw: {
        value: function () {
            if (this.menuItemModel && this.menuItemModel.keyEquivalent && this.menuItemModel.keyEquivalent.length) {
                this.templateObjects.menuButton.element.dataset.shortcut = this.menuItemModel.keyEquivalent;
            }

            if (this.menuFlashing) {
                this.element.classList.remove("Flashing");
                // Trigger a reflow to make sure the animation is played (http://css-tricks.com/restart-css-animation/)
                this.element.offsetWidth = this.element.offsetWidth;
                this.element.classList.add("Flashing");
                this.menuFlashing = false;
            }
        }
    }

});
