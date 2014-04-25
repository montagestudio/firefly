/*global window */
if (typeof window.Declarativ === "undefined") {
    window.Declarativ = {};
}

(function(ns) {
    ns.MontageStudio = Object.create(Object.prototype, {
        init: {
            value: function(websocket) {
                this._ws = websocket;
            }
        },

        _ws: {
            value: null,
            writable: true
        },

        _sendMessage: {
            value: function(name, args) {
                this._ws.send(JSON.stringify({
                    type: "command",
                    command: name,
                    args: args
                }));
            }
        },

        inspectComponent: {
            value: function(ownerModuleId, componentLabel) {
                this._sendMessage("inspectComponent", {
                    ownerModuleId: ownerModuleId,
                    componentLabel: componentLabel
                });
            }
        }
    });
})(window.Declarativ);