var log = require("../logging").from(__filename);
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

        promises = this._notificationsQueue.map(function(notification) {
            return notification.fn.apply(this, notification.args);
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
            this._notificationsQueue.push({fn:this.showNotification, args:[message]});
        }

        return Q.all(frontendKeys.map(function (id) {
            return frontends[id].showNotification(message);
        })).thenResolve();
    },

    dispatchAppEventNamed: function (type, canBubble, cancelable, detail) {
        var frontendKeys = Object.keys(frontends);

        if (frontendKeys.length === 0) {
            this._notificationsQueue.push({fn:this.dispatchAppEventNamed, args:[type, canBubble, cancelable, detail]});
        }

        return Q.all(frontendKeys.map(function (id) {
            return frontends[id].dispatchAppEventNamed(type, canBubble, cancelable, detail);
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


Frontend.prototype.dispatchAppEventNamed = function(type, canBubble, cancelable, detail) {
    if (this._connection) {
        return this._connection.invoke("dispatchAppEventNamed", type, canBubble, cancelable, detail);
    } else {
        log("dispatchAppEventNamed: frontend service is not available yet");
        return Q.resolve();
    }
};
