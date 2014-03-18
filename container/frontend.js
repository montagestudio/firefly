var log = require("logging").from(__filename);
var Q = require("q");

var frontends = {};

/**
 * The frontendId identifies a specific project and is in the form of
 * <username>/<git-user>/<git-repo>
 */

module.exports = {
    _notificationsQueue: [],

    getFrontend: function(frontendId) {
        return Q.resolve(frontends[frontendId]);
    },

    addFrontend: function(frontendId, connection) {
        var promises;

        frontends[frontendId] = new Frontend(connection);

        promises = this._notificationsQueue.map(function(message) {
            return this.showNotification(message);
        }, this);
        this._notificationsQueue.clear();

        return Q.all(promises);
    },

    deleteFrontend: function(frontendId) {
        delete frontends[frontendId];
        return Q.resolve();
    },

    showNotification: function (message) {
        var frontendKeys = Object.keys(frontends);

        if (frontendKeys.length === 0) {
            this._notificationsQueue.push(message);
        }

        return Q.all(frontendKeys.map(function (id) {
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
