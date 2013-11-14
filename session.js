var Q = require("q");
var Cookie = require("q-io/http-cookie");
var uuid = require("uuid");

exports = module.exports = Session;
function Session(key, secret, cookie, store) {
    if (!key || ! secret) {
        throw new Error("key and secret must be given");
    }
    cookie = cookie || {};
    cookie.path = cookie.path || "/";
    // cookie.httpOnly = typeof cookie.httpOnly !== "undefined" ? !!cookie.httpOnly : true;

    store = store || new exports.Memory();

    return function (app) {
        return function (request, response) {
            // self-awareness
            if (request.session) {
                return app(request, response);
            }

            var xxx;
            var _id = request.cookies[key];
            var _session;
            if (_id) {
                xxx = store.get(_id)
                .then(function (session) {
                    if (!session) {
                        return create();
                    }
                    _session = request.session = session;
                    return app(request, response);
                });
            } else {
                xxx = create();
            }

            function create() {
                return store.create()
                .then(function (session) {
                    _id = session.sessionId;
                    _session = request.session = session;

                    return Q.when(app(request, response), function (response) {
                        var setCookies = response.headers["set-cookie"] || [];
                        if (!Array.isArray(setCookies)) {
                            setCookies = [setCookies];
                        }
                        // Broken because q-io encodes the path, when it shouldn't
                        // setCookies.push(Cookie.stringify(key, session.sessionId, cookie));
                        setCookies.push(key + "=" + _id + "; Path=/");
                        response.headers["set-cookie"] = setCookies;
                        return response;
                    });
                });
            }

            return xxx.then(function (response) {
                return store.set(_id, _session).thenResolve(response);
            });
        };
    };
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

