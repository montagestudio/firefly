var Q = require("q");
var log = require("logging").from(__filename);
var joey = require("joey");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var environment = require("./environment");

var LogStackTraces = require("./log-stack-traces");
var parseCookies = require("./parse-cookies");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    //jshint +W116

    return Q.resolve(joey
    .error()
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    .methods(function (method) {
        method("POST")
        .route(function (route) {
            // This endpoint recieves a POST request with a session ID as the
            // payload. It then "echos" this back as a set-cookie, so that
            // the project domain now has the session cookie from the app domain
            route("session").app(function (request, response) {
                if (request.headers.origin === environment.getAppUrl()) {
                    return request.body.read()
                    .then(function (body) {
                        var sessionId = JSON.parse(body.toString("utf8"));
                        return {
                            status: 200,
                            headers: {
                                // TODO do this through the session object
                                "set-cookie": "session=" + sessionId + "; Path=/; HttpOnly" // TODO Domain
                            },
                            body: []
                        };
                    });
                } else {
                    log("Invalid request to /session from origin", request.headers.origin);
                    return {
                        status: 403,
                        headers: {},
                        body: ["Bad origin"]
                    };
                }
            });
        });
    })
    .tap(parseCookies)
    .use(sessions)
    .use(checkSession(sessions.getKey()))
    .methods(function (method) {
        method("GET")
        .app(function (request) {
            var path = environment.getProjectPathFromSessionAndProjectUrl(request.session, request.headers.host);

            log("rerooting to", fs.join(path));
            return fs.reroot(fs.join(path)).then(function(fs) {
                return fs.isFile(request.path).then(function(isFile) {
                    if (isFile) {
                        return HttpApps.file(request, request.path, null, fs);
                    } else {
                        return StatusApps.notFound(request);
                    }
                });
            });
        });
    }));
}

