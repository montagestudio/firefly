var Q = require("q");
var packedSession = require("./packed-session");
var uuid = require("uuid");

// TODO expire sessions that have not been used in a while

module.exports = GithubSessionStore;
function GithubSessionStore() {
    this.sessions = {};
}

GithubSessionStore.prototype.get = function get(id) {
    var self = this;
    return Q.fcall(function () {
        var session = self.sessions[id];
        if (!session) {
            // If there's no cached session try and unpack it
            session = {};
            var valid = packedSession.unpack(id, session);
            if (valid) {
                self.sessions[id] = session;
            } else {
                // otherwise if it's not valid
                session = void 0;
            }
        }

        if (session && typeof previousKey === "undefined") {
            // Used for dirty checking in `set`
            Object.defineProperty(session, "__previousKey", {
                configurable: true,
                enumerable: false,
                writable: false,
                value: packedSession.key(session)
            });
        }

        return session;
    });
};

GithubSessionStore.prototype.set = function set(_, session) {
    var self = this;
    return Q.fcall(function () {
        // Don't do anything if there is no data in the session, or if the
        // session id fields haven't changed.
        var previousKey = session && session.__previousKey;
        if (
            Object.keys(session).length === 0 ||
            (
                session.sessionId &&
                typeof previousKey !== "undefined" &&
                previousKey === packedSession.key(session)
            )
        ) {
            return;
        }

        // Remove the previousKey as it has now changed
        delete session.__previousKey;

        var newId;
        if (session.githubAccessToken && session.username) {
            newId = packedSession.pack(session);
        } else {
            newId = uuid.v4();
        }
        // If the session wasn't able to be packed don't change the session
        if (!newId) {
            return;
        }
        // Remove previous session cache
        delete self.sessions[session.sessionId];
        // Update the sessionId
        session.sessionId = newId;
        // And cache the new session
        self.sessions[newId] = session;
    });
};

GithubSessionStore.prototype.create = function create() {
    return Q.fcall(function () {
        var session = {};

        return session;
    });
};

GithubSessionStore.prototype.destroy = function destroy(id) {
    var self = this;
    return Q.fcall(function() {
        delete self.sessions[id];
    });
};
