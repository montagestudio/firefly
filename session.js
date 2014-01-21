var log = require("logging").from(__filename);
var Q = require("q");
var uuid = require("uuid");
var parseCookies = require("./parse-cookies");

var COOKIE_TIMEOUT_DAYS = 30;
var COOKIE_TIMEOUT_MS = COOKIE_TIMEOUT_DAYS * (1000 * 60 * 60 * 24);

exports = module.exports = Session;
function Session(key, secret, cookie, store) {
    if (!key || ! secret) {
        throw new Error("key and secret must be given");
    }
    cookie = cookie || {};
    cookie.path = cookie.path || "/";
    // cookie.httpOnly = typeof cookie.httpOnly !== "undefined" ? !!cookie.httpOnly : true;

    store = store || new exports.Memory();

    var setSessionCookie = function(response, id, expiresDate) {
        var setCookies = response.headers["set-cookie"] || [];
        if (!Array.isArray(setCookies)) {
            setCookies = [setCookies];
        }
        // Broken because q-io encodes the path, when it shouldn't
        // setCookies.push(Cookie.stringify(key, session.sessionId, cookie));

        var cookie = key + "=" + id + "; Path=/;";
        if (expiresDate) {
            cookie += " Expires=" + expiresDate;
        }

        setCookies.push(cookie);
        response.headers["set-cookie"] = setCookies;

        return response;
    };

    var result = function (app) {
        return function (request, response) {
            // self-awareness
            if (request.session) {
                return app(request, response);
            }

            var done;
            var _id = request.cookies[key];
            var _session;
            var _created;
            if (_id) {
                done = store.get(_id)
                .then(function (session) {
                    if (!session) {
                        return create();
                    }
                    _session = request.session = session;
                });
            } else {
                done = create();
            }

            function create() {
                return store.create()
                .then(function (session) {
                    _id = session.sessionId;
                    _session = request.session = session;
                    _created = true;
                });
            }

            return done.then(function () {
                return Q.when(app(request, response), function (response) {
                    if (_session._destroyed) {
                        log("destroyed: " + _id);
                        setSessionCookie(response, "", new Date(0));
                        return store.destroy(_id).thenResolve(response);
                    } else {
                        var done = Q(),
                            _setCookie = false;

                        if (_id !== request.session.sessionId) {
                            // Reset the session
                            log("reset: " + request.session.sessionId);
                            done = store.destroy(_id).then(function() {
                                _id = request.session.sessionId;
                                _setCookie = true;
                            });
                        } else if (_created) {
                            log("created: " + _id);
                            _setCookie = true;
                        }

                        return done.then(function() {
                            if (_setCookie) {
                                var timeoutDate = new Date(Date.now() + COOKIE_TIMEOUT_MS);
                                setSessionCookie(response, _id, timeoutDate);
                            }
                            return store.set(_id, _session).thenResolve(response);
                        });
                    }
                });
            });
        };
    };

    result.get = function (id) {
        return store.get(id);
    };

    result.destroy = function(session) {
        return Q.fcall(function() {
            session._destroyed = true;
        });
    };

    /**
     * Receives a request object and a callback function that receives the
     * session found in the request cookies.
     * The callback should return a promise that will be propagated to the
     * promise returned by the getSession function itself.
     * When the promise returned by the callback is resolved the session object
     * should not be modified anymore as those changes will not be stored.
     */
    result.getSession = function(request, callback) {
        var _session;
        // The request has the session cookies, but hasn't gone through
        // the joey chain, and so they haven't been parsed into .cookies
        // Do that manually here
        parseCookies(request);

        return this.get(request.cookies[key]).then(function(session) {
            _session = session;
            return callback(session);
        }).then(function(result) {
            if (_session) {
                // Save session new state.
                return store.set(_session.sessionId, _session).thenResolve(result);
            } else {
                return result;
            }
        });
    };

    result.getKey = function() {
        return key;
    };

    return result;
}

exports.Memory = Memory;
function Memory() {
    this.sessions = {};
}

Memory.prototype.get = function get(id) {
    var self = this;
    return Q.fcall(function () {
        var session = self.sessions[id];
        if (session) {
            return JSON.parse(session);
        }
    });
};

Memory.prototype.set = function set(id, session) {
    var self = this;
    return Q.fcall(function () {
        self.sessions[id] = JSON.stringify(session);
    });
};

Memory.prototype.create = function create() {
    var self = this;
    return Q.fcall(function () {
        var id = uuid.v4();
        var session = {
            sessionId: id
        };
        self.sessions[id] = JSON.stringify(session);

        return session;
    });
};

Memory.prototype.destroy = function destroy(id) {
    var self = this;
    return Q.fcall(function() {
        delete self.sessions[id];
    });
};