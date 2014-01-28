var log = require("logging").from(__filename);
var joey = require("joey");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var environment = require("./environment");
var Preview = require("./preview/preview-server").Preview;

var LogStackTraces = require("./log-stack-traces");
var parseCookies = require("./parse-cookies");

var JsonApps = require("q-io/http-apps/json");
var sanitize = require("./sanitize");

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
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
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
            if (request.hostname.indexOf("xip.io") !== -1) {
                return serveProject(request, response);
            } else {
                // route /:user/:app/:action
                return next(request, response);
            }
        };
    })
    .route("/api/:owner/:repo/", function (route) {
        route("init")
        .methods(function (method) {
            method("POST")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function() {
                    log("init handleEndpoint");
                    return request.projectWorkspace.initializeWorkspace();
                }, function() {
                    return {message: "initialized"};
                });
            });
        });

        route("components")
        .methods(function (method) {
            method("POST")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function(data) {
                    return request.projectWorkspace.createComponent(
                        data.name);
                }, function() {
                    return {message: "created"};
                });
            });
        });

        route("modules")
        .methods(function (method) {
            method("POST")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function(data) {
                    return request.projectWorkspace.createModule(
                        data.name, data.extendsModuleId,
                        data.extendsName);
                }, function() {
                    return {message: "created"};
                });
            });
        });

        route("flush")
        .methods(function (method) {
            method("POST")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function(data) {
                    return request.projectWorkspace.flushWorkspace(
                        data.message);
                }, function() {
                    return {message: "flushed"};
                });
            });
        });

        route("workspace")
        .methods(function (method) {
            method("GET")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function() {
                    return request.projectWorkspace.existsWorkspace();
                }, function(exists) {
                    return {created: exists};
                });
            });
        });

        route("save")
        .methods(function (method) {
            method("POST")
            .use(setupProjectWorkspace(directory, minitPath))
            .app(function (request) {
                return handleEndpoint(request, function(data) {
                    return request.projectWorkspace.saveFile(
                        data.filename, data.contents);
                }, function() {
                    return {message: "saved"};
                });
            });
        });
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
        if (request.headers.host.indexOf("xip.io") !== -1) {
            preview.wsServer.handleUpgrade(request, socket, head);
        } else {
            websocketServer.handleUpgrade(request, socket, head);
        }
    };

    return chain;
}

/**
 * Endpoints (to be moved to another file in the future)
 */

/**
 * Executes an operation and depending on the result creates a success or error
 * message to send back to the browser.
 * The message is in the shape: {"owner": ..., "repo": ...}
 *
 * @param {function} endpointCallback The function that performs the operation
 *        of the endpoint, returns a promise to the completion of the operation.
 *        The function receives the owner and the repo as arguments.
 *        If the operation succeeds then {@link successCallback} is called with
 *        the resolved value. If the operation fails then an error message is
 *        returned.
 * @param {function} successCallback The function that receives the value of
 *        that the operation resolved it and is expected to return the message
 *        that will be turned into a response back to the browser.
 */
function handleEndpoint(request, endpointCallback, successCallback) {
    var owner = sanitize.sanitizeDirectoryName(request.params.owner),
        repo = sanitize.sanitizeDirectoryName(request.params.repo);

    var createMessage = function(message) {
        message.owner = owner;
        message.repo = repo;
        return message;
    };

    return request.body.read()
    .then(function(body) {
        var data;

        if (body.length > 0) {
            try {
                data = JSON.parse(body.toString());
            } catch(ex) {
                throw new Error("Malformed JSON message received.");
            }
        } else {
            data = {};
        }

        return endpointCallback(data);
    })
    .then(function() {
        var successMessage;

        if (successCallback) {
            successMessage = successCallback(arguments[0]);
        } else {
            successMessage = {};
        }

        return JsonApps.json(createMessage(successMessage));
    })
    .fail(function(reason) {
        log("*handleEndpoint fail*", reason);
        return JsonApps.json(createMessage({
            error: reason.message
        }));
    });
}
