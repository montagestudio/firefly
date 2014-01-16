var log = require("logging").from(__filename);
var Q = require("q");

module.exports = {
    // Set by "./websocket"
    _frontend: null,

    showNotification: function(message) {
        if (this._frontend) {
            return this._frontend.invoke("showNotification", message);
        } else {
            log("showNotification: frontend service is not available yet");
            return Q.resolve();
        }
    }
};
