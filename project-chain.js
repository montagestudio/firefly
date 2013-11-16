var Q = require("q");
var log = require("logging").from(__filename);
var joey = require("joey");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var JsonApps = require("q-io/http-apps/json");
var sanitize = require("./sanitize");
var environment = require("./environment");

var parseCookies = require("./parse-cookies");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.session) throw new Error("options.session required");
    var session = options.session;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.directory) throw new Error("options.directory required");
    var directory = options.directory;
    if (!options.minitPath) throw new Error("options.minitPath required");
    var minitPath = options.minitPath;
    //jshint +W116

    return Q.resolve(joey
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    .methods(function (method) {
        method("POST")
        .route(function (route) {
            // This endpoint recieves a POST request with a session ID as the
            // payload. It then "echos" this back as a set-cookie, so that
            // the project domain now has the session cookie from the app domain
            route("session").use(function (next) {
                return function (request, response) {
                    if (request.headers.origin === environment.getAppUrl()) {
                        return request.body.read()
                        .then(function (content) {
                            var sessionId = content.toString("utf8");
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
                        return next(request, response);
                    }
                };
            });
        });
    })
    .tap(parseCookies)
    .use(session)
    .use(checkSession)
    .use(setupProjectWorkspace(fs, directory, minitPath))
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

        method("POST")
        .route(function(route) {
            route(":owner/:repo/init")
            .app(function(request) {
                var owner = sanitize.sanitizeDirectoryName(request.params.owner),
                    repo = sanitize.sanitizeDirectoryName(request.params.repo);

                return request.projectWorkspace.initRepository(owner, repo)
                .then(function() {
                    return JsonApps.json({
                        message: "initialized",
                        owner: owner,
                        repository: repo
                    });
                })
                .fail(function(reason) {
                    if (reason.status === 404) {
                        log("repository not found: " + owner + "/" + repo);
                        return JsonApps.json({
                            error: "not found",
                            owner: owner,
                            repository: repo
                        });
                    } else {
                        log("repository init error: " + owner + "/" + repo);
                        return JsonApps.json({
                            error: "error",
                            owner: owner,
                            repository: repo
                        });
                    }
                });
            });
        });
    }));
}

