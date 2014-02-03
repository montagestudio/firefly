var log = require("logging").from(__filename);
var joey = require("joey");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var environment = require("../environment");
var Preview = require("./preview/preview-server").Preview;

var LogStackTraces = require("../log-stack-traces");
var parseCookies = require("../parse-cookies");

var api = require("./api");
var websocket = require("./websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.client) throw new Error("options.client required");
    var client = fs.absolute(options.client);
    if (!options.clientServices) throw new Error("options.clientServices required");
    var clientServices = options.clientServices;
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.directory) throw new Error("options.directory required");
    var directory = options.directory;
    if (!options.minitPath) throw new Error("options.minitPath required");
    var minitPath = options.minitPath;
    //jshint +W116
    var preview = Preview(sessions);

    var chain = joey
    .error()
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .route(function (_, __, ___, POST) {
        // This endpoint recieves a POST request with a session ID as the
        // payload. It then "echos" this back as a set-cookie, so that
        // the project domain now has the session cookie from the app domain
        POST("session").app(function (request, response) {
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
    })
    .tap(parseCookies)
    .use(sessions)
    .use(checkSession)
    .use(function (next) {
        var serveProject = preview(function (request) {
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

        return function (request, response) {
            if (endsWith(request.headers.host, environment.getProjectHost())) {
                return serveProject(request, response);
            } else {
                // route /:user/:app/:action
                return next(request, response);
            }
        };
    })
    .route(function (route) {
        route("api/...").app(api(setupProjectWorkspace, directory, minitPath).end());
    });

    // These services should be customized per websocket connection, to
    // encompass the session information
    var services = {};
    Object.keys(clientServices).forEach(function (name) {
        services[name] = require(fs.join(client, clientServices[name]));
    });
    services["file-service"] = require("./services/file-service");
    services["extension-service"] = require("./services/extension-service");
    services["env-service"] = require("./services/env-service");
    services["preview-service"] = require("./services/preview-service").service;
    services["package-manager-service"] = require("./services/package-manager-service");

    var websocketServer = websocket(sessions, services, client);

    chain.upgrade = function (request, socket, head) {
        if (endsWith(request.headers.host, environment.getProjectHost())) {
            preview.wsServer.handleUpgrade(request, socket, head);
        } else {
            websocketServer.handleUpgrade(request, socket, head);
        }
    };

    return chain;
}

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
