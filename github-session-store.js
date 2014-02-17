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
        return packedSession.unpack(id, session)
        .then(function (valid) {
            if (valid) {
                return session;
            }
            // otherwise if it's not valid so return nothing
        });
            self.sessions[id] = session;
    });
};

GithubSessionStore.prototype.set = function set(id, session) {
    var self = this;
    return Q.fcall(function () {
        // Don't do anything if the session hasn't changed at all
        var cachedSession = self.sessions[id];
        if (JSON.stringify(cachedSession) === JSON.stringify(session)) {
            return;
        }

        return packedSession.pack(session)
        .then(function (id) {
            // Remove previous session cache
            delete self.sessions[session.sessionId];
            // Update the sessionId
            session.sessionId = id;
            // And cache the new session
        });
        self.sessions[newId] = session;
    });
};

GithubSessionStore.prototype.create = function create() {
    return Q.fcall(function () {
        var session = {
            sessionId: ""
        };

        return session;
    });
};

GithubSessionStore.prototype.destroy = function destroy(id) {
    var self = this;
    return Q.fcall(function() {
        delete self.sessions[id];
    });
};
