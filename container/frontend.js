var log = require("logging").from(__filename);
var Q = require("q");

var frontends = {};

/**
 * The frontendId identifies a specific project and is in the form of
 * <username>/<git-user>/<git-repo>
 */

module.exports = {
    getFrontend: function(frontendId) {
        return Q.resolve(frontends[frontendId]);
    },

    addFrontend: function(frontendId, connection) {
        frontends[frontendId] = new Frontend(connection);
        return Q.resolve();
    },

    deleteFrontend: function(frontendId) {
        delete frontends[frontendId];
        return Q.resolve();
    },

    showNotification: function (message) {
        return Q.all(Object.keys(frontends).map(function (id) {
            return frontends[id].showNotification(message);
        })).thenResolve();
    }
};

function Frontend(connection) {
    this._connection = connection;
}

Frontend.prototype.showNotification = function(message) {
    if (this._connection) {
        return this._connection.invoke("showNotification", message);
    } else {
        log("showNotification: frontend service is not available yet");
        return Q.resolve();
    }
};
