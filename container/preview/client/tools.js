/*global window, document, MontageStudio */
//jshint -W106
if (typeof window.MontageStudio === "undefined") {
    window.MontageStudio = {};
}

(function(ns) {
    var style = document.createElement("style");
    style.textContent = "* {cursor: cell !important}";

    ns.Tools = Object.create(Object.prototype, {
        selectComponentToInspect: {
            value: function() {
                var self = this;

                this.selectComponentWithPointer(function(component) {
                    var label;
                    var ownerModuleId;

                    // If the selected component doesn't have an owner component
                    // then just open the component itself.
                    if (component.ownerComponent) {
                        label = self.getComponentLabel(component);
                        ownerModuleId = self.getOwnerComponentModuleId(component);
                    } else {
                        label = "owner";
                        ownerModuleId = self.getComponentModuleId(component);
                    }

                    MontageStudio.MontageStudio.inspectComponent(ownerModuleId, label);
                });
            }
        },

        selectComponentWithPointer: {
            value: function(callback) {
                var self = this,
                    currentElement, currentComponent;

                this._showCrosshair();

                function updateTarget(target) {
                    if (target === currentElement) {
                        return;
                    }
                    currentElement = target;

                    do {
                        if (target.component) {
                            var ownerComponent = target.component.ownerComponent;

                            if (target.component !== currentComponent &&
                                (!ownerComponent ||
                                  self.isApplicationComponent(ownerComponent))) {
                                self._highlightComponent(target.component);
                                currentComponent = target.component;
                                break;
                            }
                        }
                    } while(target = /*assignment*/target.parentNode);
                }

                function selectCurrentComponent(event) {
                    self._ignoreEvent(event);
                    removeEventListeners();
                    self._hideCrosshair();
                    self._hideComponentHighlight();
                    callback(currentComponent);
                }

                function handleMousemove(event) {
                    self._ignoreEvent(event);
                    updateTarget(event.target);
                }

                function handleTouchmove(event) {
                    self._ignoreEvent(event);
                    var touch = event.changedTouches[0];
                    var x = touch.clientX;
                    var y = touch.clientY;
                    var target = document.elementFromPoint(x, y);

                    updateTarget(target);
                }

                function handleTouchcancel(event) {
                    self._ignoreEvent(event);
                    removeEventListeners();
                }

                function addEventListener(name, handler) {
                    window.nativeAddEventListener(name, handler, true);
                }

                function removeEventListener(name, handler) {
                    window.nativeRemoveEventListener(name, handler, true);
                }

                function removeEventListeners() {
                    removeEventListener("mousemove", handleMousemove);
                    removeEventListener("mouseup", selectCurrentComponent);
                    removeEventListener("mousedown", self._ignoreEvent);
                    removeEventListener("click", self._ignoreEvent);

                    removeEventListener("touchdown", handleTouchmove);
                    removeEventListener("touchmove", handleTouchmove);
                    removeEventListener("touchup", selectCurrentComponent);
                    removeEventListener("touchcancel", handleTouchcancel);
                }

                addEventListener("mousemove", handleMousemove);
                addEventListener("mouseup", selectCurrentComponent);
                addEventListener("mousedown", this._ignoreEvent);
                addEventListener("click", this._ignoreEvent);

                addEventListener("touchdown", handleTouchmove);
                addEventListener("touchmove", handleTouchmove);
                addEventListener("touchup", selectCurrentComponent);
                addEventListener("touchcancel", handleTouchcancel);
            }
        },

        getComponentLabel: {
            value: function(component) {
                return component._montage_metadata.label;
            }
        },

        getOwnerComponentModuleId: {
            value: function(component) {
                if (component.ownerComponent) {
                    return this.getComponentModuleId(component.ownerComponent);
                }

                return null;
            }
        },

        getComponentModuleId: {
            value: function(component) {
                if (component._montage_metadata) {
                    return component._montage_metadata.moduleId;
                }

                return null;
            }
        },

        isApplicationComponent: {
            value: function(component) {
                return component._montage_metadata.require.location === window.require.location;
            }
        },

        _ignoreEvent: {
            value: function(event) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        _highlightComponent: {
            value: function(component) {
                var ownerModuleId = this.getOwnerComponentModuleId(component);

                MontageStudio.Highlighter.hideHighlights("main");
                MontageStudio.Highlighter.highlightElement(component.element, "main",
                    this.getComponentLabel(component),
                    ownerModuleId ? "(" + ownerModuleId + ")" : "");
            }
        },

        _hideComponentHighlight: {
            value: function() {
                MontageStudio.Highlighter.hideHighlights("main");
            }
        },

        _showCrosshair: {
            value: function() {
                document.head.appendChild(style);
            }
        },

        _hideCrosshair: {
            value: function() {
                document.head.removeChild(style);
            }
        }
    });

    /**
     * This Object creates and manages different types of highlighters.
     * A highlight is a rectangle that can be used to frame a DOM element.
     * A highlight of a specific type can be obtained by calling getHighlight,
     * a new one of the designated type will be created or reused if there are
     * any available.
     * Different types can be created by calling addType, each type can have
     * its own frame color and shadowColor.
     * You can hide all highlights of a specific type by calling hideHighlights.
     */
    ns.Highlighter = {
        _types: {},

        addType: function(name, color, shadowColor) {
            this._types[name] = {
                color: color,
                shadowColor: shadowColor,
                active: [],
                inactive: []
            };
        },

        highlightElement: function(element, typeName, label, subLabel) {
            var highlight = this.getHighlight(typeName);

            highlight.show(element, label, subLabel);
        },

        hideHighlights: function(typeName) {
            var type = this._types[typeName];

            while (type.active.length > 0) {
                type.active[0].hide();
                type.inactive.push(type.active.shift());
            }
        },

        getHighlight: function(name) {
            var type = this._types[name],
                highlight;

            if (type.inactive.length > 0) {
                highlight = type.inactive.pop();
            } else {
                highlight = new Highlight(type.color, type.shadowColor);
            }

            type.active.push(highlight);
            return highlight;
        }
    };

    function Highlight(color, shadowColor) {
        this.label = document.createElement("div");
        this.top = document.createElement("div");
        this.right = document.createElement("div");
        this.bottom = document.createElement("div");
        this.left = document.createElement("div");

        this.mainLabel = this.label.appendChild(document.createElement("span"));
        this.subLabel = this.label.appendChild(document.createElement("span"));

        this.label.setAttribute("style", this._getTextStyleString());
        this.subLabel.style.fontSize = "smaller";
        this.subLabel.style.fontStyle = "italic";
        this.subLabel.style.marginLeft = "5px";

        this.top.setAttribute("style", this._getBorderStyleString("top", color, shadowColor));
        this.right.setAttribute("style", this._getBorderStyleString("right", color, shadowColor));
        this.bottom.setAttribute("style", this._getBorderStyleString("bottom", color, shadowColor));
        this.left.setAttribute("style", this._getBorderStyleString("left", color, shadowColor));

        document.body.appendChild(this.label);
        document.body.appendChild(this.top);
        document.body.appendChild(this.right);
        document.body.appendChild(this.bottom);
        document.body.appendChild(this.left);
    }

    Highlight.prototype.show = function(element, label, subLabel) {
        var rect = this._getElementRect(element);
        // size
        this.top.style.width = rect.width + 2 + "px";
        this.right.style.height = rect.height + 2 + "px";
        this.bottom.style.width = rect.width + 2 + "px";
        this.left.style.height = rect.height + 2 + "px";
        // rect
        this.top.style.top = rect.top - 1 + "px";
        this.top.style.left = rect.left - 1 + "px";
        this.right.style.top = rect.top - 1 + "px";
        this.right.style.left = rect.left + rect.width + "px";
        this.bottom.style.top = rect.top + rect.height + "px";
        this.bottom.style.left = rect.left - 1 + "px";
        this.left.style.top = rect.top - 1 + "px";
        this.left.style.left = rect.left - 1 + "px";
        // label
        if (label) {
            this.label.style.top = rect.top - 24 + "px";
            this.label.style.left = rect.left - 2 + "px";
            this.mainLabel.textContent = label;
            this.subLabel.textContent = subLabel || "";
            this.label.style.display = "block";
        }

        this.top.style.display = "block";
        this.right.style.display = "block";
        this.bottom.style.display = "block";
        this.left.style.display = "block";
    };

    Highlight.prototype.hide = function() {
        this.label.style.display = "none";
        this.top.style.display = "none";
        this.right.style.display = "none";
        this.bottom.style.display = "none";
        this.left.style.display = "none";
    };

    Highlight.prototype._getElementRect = function(element) {
        return element.getBoundingClientRect();
    };

    Highlight.prototype._getBorderStyleString = function(side, color, shadowColor) {
        var shadow;

        color = color || "white";

        if (side === "top") {
            shadow = "-2px -2px 1px 1px " + shadowColor +
                ", 2px -2px 1px 1px " + shadowColor;
        } else if (side === "right") {
            shadow = "2px -2px 1px 1px " + shadowColor +
                ", 2px 2px 1px 1px " + shadowColor;
        } else if (side === "bottom") {
            shadow = "-2px 2px 1px 1px " + shadowColor +
                ", 2px 2px 1px 1px " + shadowColor;
        } else if (side === "left") {
            shadow = "-2px -2px 1px 1px " + shadowColor +
                ", -2px 2px 1px 1px black; " + shadowColor;
        } else {
            throw new Error("Side " + side + " not supported.");
        }

        return "border-" + side + ": 1px solid " + color + ";" +
            "z-index: 99999;" +
            "position: absolute;" +
            (shadowColor ? "box-shadow: " + shadow : "");
    };

    Highlight.prototype._getTextStyleString = function(color, shadowColor) {
        color = color || "white";
        shadowColor = shadowColor || "#000";

        return "z-index: 99999;" +
            "position: absolute;" +
            "height: 20px;" +
            "color: " + color + ";" +
            "font-family: Arial;" +
            "text-shadow: -1px 0 #000," +
            "0 1px " + shadowColor + "," +
            "1px 0 " + shadowColor + "," +
            "0 -1px " + shadowColor + "," +
            "-1px -1px " + shadowColor + "," +
            "1px 1px " + shadowColor + "," +
            "-1px 1px " + shadowColor + "," +
            "1px -1px " + shadowColor + "";
    };

    MontageStudio.Highlighter.addType("main", "white", "black");
})(window.MontageStudio);
//jshint +W106