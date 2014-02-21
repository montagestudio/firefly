var Q = require("q");
var packedSession = require("./packed-session");

// TODO expire sessions that have not been used in a while

module.exports = GithubSessionStore;
function GithubSessionStore() {
    this.sessions = {};
}

GithubSessionStore.prototype.get = function get(id) {
    var self = this;
    return Q.fcall(function () {
        // If this session is cached, just return it...
        var cachedSession = self.sessions[id];
        if (cachedSession) {
            return cachedSession;
        }

        // ...otherwise try and unpack it
        var session = {};
        var valid = packedSession.unpack(id, session);
        if (valid) {
            self.sessions[id] = session;
            return session;
        }
        // otherwise if it's not valid so return nothing
    });
};

GithubSessionStore.prototype.set = function set(_, session) {
    var self = this;
    return Q.fcall(function () {
        if (Object.keys(session).length === 0) {
            return;
        }
        // Don't do anything if the session hasn't changed at all
        var cachedSession = self.sessions[session.sessionId];
        if (JSON.stringify(cachedSession) === JSON.stringify(session)) {
            return;
        }

        var newId = packedSession.pack(session);
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
