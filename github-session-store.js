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
        // Don't do anything if there is no data in the session, or if the
        // session hasn't changed from the previous one at all
        if (
            Object.keys(session).length === 0 ||
            (
                session.sessionId &&
                JSON.stringify(self.sessions[session.sessionId]) === JSON.stringify(session)
            )
        ) {
            return;
        }

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
