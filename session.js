var log = require("./logging").from(__filename);
var Promise = require("bluebird");
var uuid = require("uuid");
var parseCookies = require("./parse-cookies");

var COOKIE_TIMEOUT_DAYS = 30;
var COOKIE_TIMEOUT_MS = COOKIE_TIMEOUT_DAYS * (1000 * 60 * 60 * 24);

exports = module.exports = Session;
function Session(key, secret, cookieOptions, store) {
    if (!key || ! secret) {
        throw new Error("key and secret must be given");
    }
    cookieOptions = cookieOptions || {};
    cookieOptions.path = cookieOptions.path || "/";
    // Defaults to true
    cookieOptions.httpOnly = typeof cookieOptions.httpOnly !== "undefined" ? !!cookieOptions.httpOnly : true;
    // Hack to remove port number, as cookies don't allow the port
    cookieOptions.domain = cookieOptions.domain && cookieOptions.domain.replace(/:[0-9]+$/, "");

    store = store || new exports.Memory();

    var setSessionCookie = function(response, id, expiresDate) {
        var setCookies = response.headers["set-cookie"] || [];
        if (!Array.isArray(setCookies)) {
            setCookies = [setCookies];
        }
        // Broken because q-io encodes the path, when it shouldn't
        // setCookies.push(Cookie.stringify(key, session.sessionId, cookie));

        var cookieParts = [key + "=" + id];
        cookieParts.push("Path=" + cookieOptions.path);
        if (cookieOptions.httpOnly) {
            cookieParts.push("HttpOnly");
        }
        if (cookieOptions.domain) {
            cookieParts.push("Domain=" + cookieOptions.domain);
        }
        if (expiresDate) {
            cookieParts.push("Expires=" + expiresDate);
        }

        setCookies.push(cookieParts.join("; "));
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
            var _created;
            if (_id) {
                done = store.get(_id)
                .then(function (session) {
                    if (!session) {
                        return create();
                    }
                    request.session = session;
                });
            } else {
                done = create();
            }

            function create() {
                return store.create()
                .then(function (session) {
                    _id = session.sessionId;
                    request.session = session;
                    _created = true;
                });
            }

            return done.then(function () {
                return Promise.resolve(app(request, response))
                .then(function (response) {
                    if (request.session._destroyed) {
                        log("destroyed", _id);
                        setSessionCookie(response, "", new Date(0));
                        return store.destroy(_id).thenResolve(response);
                    } else {
                        var _setCookie = false;

                        return store.set(_id, request.session)
                            .then(function () {
                                if (_id !== request.session.sessionId) {
                                    // The session id has changed
                                    log("changed id from", _id, "to", request.session.sessionId);
                                    return store.destroy(_id).then(function () {
                                        _id = request.session.sessionId;
                                        _setCookie = true;
                                    });
                                } else if (_created) {
                                    log("created", _id);
                                    _setCookie = true;
                                }
                            })
                            .then(function() {
                                if (_setCookie && _id) {
                                    log("set cookie");
                                    var timeoutDate = new Date(Date.now() + COOKIE_TIMEOUT_MS);
                                    setSessionCookie(response, _id, timeoutDate);
                                }
                                return response;
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
        return new Promise(function (resolve) {
            session._destroyed = true;
            resolve();
        })
    };

    result.getKey = function() {
        return key;
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

    return result;
}

exports.Memory = Memory;
function Memory() {
    this.sessions = {};
}

Memory.prototype.get = function get(id) {
    var self = this;
    return new Promise(function (resolve) {
        var session = self.sessions[id];
        resolve(session ? JSON.parse(session) : void 0);
    });
};

Memory.prototype.set = function set(id, session) {
    var self = this;
    return new Promise(function (resolve) {
        self.sessions[id] = JSON.stringify(session);
        resolve();
    });
};

Memory.prototype.create = function create() {
    var self = this;
    return new Promise(function (resolve) {
        var id = uuid.v4();
        var session = {
            sessionId: id
        };
        self.sessions[id] = JSON.stringify(session);

        resolve(session);
    });
};

Memory.prototype.destroy = function destroy(id) {
    var self = this;
    return new Promise(function (resolve) {
        delete self.sessions[id];
        resolve();
    })
};
