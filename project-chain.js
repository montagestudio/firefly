var log = require("logging").from(__filename);
var joey = require("joey");
var APPS = require("q-io/http-apps");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var environment = require("./environment");
var PreviewServer = require("./preview/preview-server");
var checkPreviewAccess = require("./preview/check-preview-access");

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
    //jshint +W116
    var preview = PreviewServer.Preview(sessions);

    var chain = joey
    .error()
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    .tap(parseCookies)
    .use(sessions)
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
                        return sessions.changeSessionId(request.session, sessionId);
                    })
                    .then(function() {
                        return APPS.ok();
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

            route("access").app(PreviewServer.processAccessRequest);
        });
    })
    .use(checkPreviewAccess)
    .use(preview)
    .methods(function (method) {
        method("GET")
        .app(function (request) {
            var path = environment.getProjectPathFromProjectUrl(request.headers.host);

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
    });

    chain.upgrade = function (request, socket, head) {
        preview.wsServer.handleUpgrade(request, socket, head);
    };

    return chain;
}
