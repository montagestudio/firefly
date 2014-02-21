var log = require("logging").from(__filename);
var Q = require("q");
var joey = require("joey");
var APPS = require("q-io/http-apps");
// FIXME docker
// var PreviewServer = require("./preview/preview-server");
// var checkPreviewAccess = require("./preview/check-preview-access");
var environment = require("../environment");

var LogStackTraces = require("../log-stack-traces");
var parseCookies = require("../parse-cookies");

var ProxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.setupProjectContainer) throw new Error("options.setupProjectContainer required");
    var setupProjectContainer = options.setupProjectContainer;
    //jshint +W116

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
    .tap(parseCookies)
    .use(sessions)
    .route(function (_, __, ___, POST) {
        // This endpoint recieves a POST request with a session ID as the
        // payload. It then "echos" this back as a set-cookie, so that
        // the project domain now has the session cookie from the app domain
        POST("session").app(function (request, response) {
            if (request.headers.origin === environment.getAppUrl()) {
                return request.body.read()
                .then(function (body) {
                    var data = JSON.parse(body.toString("utf8"));
                    return sessions.get(data.sessionId)
                    .then(function(session) {
                        if (session) {
                            request.session = session;
                            return APPS.ok();
                        } else {
                            return APPS.badRequest(request);
                        }
                    });
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

        // POST("access").app(PreviewServer.processAccessRequest);
    })
    .use(function (next) {
        // TODO checkPreviewAccess
        var servePreview = ProxyContainer(setupProjectContainer, "static");

        return function (request, response) {
            if (endsWith(request.headers.host, environment.getProjectHost())) {
                // FIXME docker check session/do preview code stuff here
                var details = environment.getDetailsfromProjectUrl(request.url);
                request.params = request.params || {};
                request.params.owner = details.owner;
                request.params.repo = details.repo;

                return servePreview(request, response);
            } else {
                // route /:user/:app/:action
                return next(request, response);
            }
        };
    })
    .use(checkSession)
    .route(function (route) {
        route("api/:owner/:repo/...").app(ProxyContainer(setupProjectContainer, "api"));
    });

    var proxyAppWebsocket = ProxyWebsocket(setupProjectContainer, sessions, "firefly-app");
    var proxyPreviewWebsocket = ProxyWebsocket(setupProjectContainer, sessions, "firefly-preview");
    chain.upgrade = function (request, socket, body) {
        Q.try(function () {
            if (!WebSocket.isWebSocket(request)) {
                return;
            }
            var details;
            if (endsWith(request.headers.host, environment.getProjectHost())) {
                log("preview websocket");
                // FIXME docker check session/do preview code stuff here
                details = environment.getDetailsfromProjectUrl(request.headers.host);
                return proxyPreviewWebsocket(request, socket, body, details);
            } else {
                log("filament websocket");
                details = environment.getDetailsFromAppUrl(request.url);
                return proxyAppWebsocket(request, socket, body, details);
            }
        })
        .catch(function (error) {
            log("*Error setting up websocket*", error.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
        });
    };

    return chain;
}

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
