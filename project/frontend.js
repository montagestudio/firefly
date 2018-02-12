var log = require("../logging").from(__filename);
var Q = require("q");

var frontends = {};

var arraySlice = Array.prototype.slice;

/**
 * The frontendId identifies a specific project and is in the form of
 * <username>/<git-user>/<git-repo>
 */

module.exports = {
    _notificationsQueue: [],

    _addFrontendMethod: function(name) {
        this[name] = function() {
            return this._invokeFunction(name, arraySlice.call(arguments, 0));
        };
    },

    getFrontend: function(frontendId) {
        return Q.resolve(frontends[frontendId]);
    },

    addFrontend: function(frontendId, connection) {
        var promises;

        frontends[frontendId] = new Frontend(connection);

        promises = this._notificationsQueue.map(function(notification) {
            return notification.fn.apply(this, notification.args);
        }, this);
        this._notificationsQueue.length = 0;

        return Q.all(promises);
    },

    deleteFrontend: function(frontendId) {
        delete frontends[frontendId];
        return Q.resolve();
    },

    _invokeFunction: function(name, args) {
        var frontendKeys = Object.keys(frontends);

        if (frontendKeys.length === 0) {
            this._notificationsQueue.push({fn:this[name], args:args});
        }

        return Q.all(frontendKeys.map(function (id) {
            return frontends[id][name].apply(frontends[id], args);
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

Frontend.prototype.inspectComponent = function(ownerModuleId, label) {
    if (this._connection) {
        return this._connection.invoke("inspectComponent", ownerModuleId, label);
    } else {
        log("inspectComponent: frontend service is not available yet");
        return Q.resolve();
    }
};

Frontend.prototype.dispatchEventNamed = function(type, canBubble, cancelable, detail) {
    if (this._connection) {
        return this._connection.invoke("dispatchEventNamed", type, canBubble, cancelable, detail);
    } else {
        log("dispatchEventNamed: frontend service is not available yet");
        return Q.resolve();
    }
};

/**
 * Add all Frontend methods to the frontend API
 */

for (var name in Frontend.prototype) {
    if (Frontend.prototype.hasOwnProperty(name)) {
        module.exports._addFrontendMethod(name);
    }
}
