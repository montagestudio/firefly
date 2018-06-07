const log = require("logging").from(__filename);
const Q = require("q");

const frontends = {};

/**
 * The frontendId identifies a specific project and is in the form of
 * <username>/<git-user>/<git-repo>
 */

module.exports = {
    _notificationsQueue: [],

    _addFrontendMethod(name) {
        this[name] = (...args) => this._invokeFunction(name, args.slice(0));
    },

    async getFrontend(frontendId) {
        return frontends[frontendId];
    },

    async addFrontend(frontendId, connection) {
        frontends[frontendId] = new Frontend(connection);
        const promises = this._notificationsQueue.map((notification) => 
            notification.fn.apply(this, notification.args));
        this._notificationsQueue.length = 0;
        return Q.all(promises);
    },

    async deleteFrontend(frontendId) {
        delete frontends[frontendId];
    },

    async _invokeFunction(name, args) {
        const frontendKeys = Object.keys(frontends);
        if (frontendKeys.length === 0) {
            this._notificationsQueue.push({ fn: this[name], args });
        }
        await Q.all(frontendKeys.map((id) =>
            frontends[id][name].apply(frontends[id], args)))
    }
};

class Frontend {
    constructor(connection) {
        this._connection = connection;
    }

    async showNotification(message) {
        if (this._connection) {
            return this._connection.invoke("showNotification", message);
        } else {
            log("showNotification: frontend service is not available yet");
        }
    }

    async inspectComponent(ownerModuleId, label) {
        if (this._connection) {
            return this._connection.invoke("inspectComponent", ownerModuleId, label);
        } else {
            log("inspectComponent: frontend service is not available yet");
        }
    }

    async dispatchEventNamed(type, canBubble, cancelable, detail) {
        if (this._connection) {
            return this._connection.invoke("dispatchEventNamed", type, canBubble, cancelable, detail);
        } else {
            log("dispatchEventNamed: frontend service is not available yet");
        }
    }
}

/**
 * Add all Frontend methods to the frontend API
 */
Object.getOwnPropertyNames(Frontend.prototype).forEach(key => {
    if (key !== "constructor") {
        module.exports._addFrontendMethod(key);
    }
})
