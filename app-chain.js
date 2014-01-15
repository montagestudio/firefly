var log = require("logging").from(__filename);
var httpLog = require("logging").from("app-joey");
var joey = require("joey");
var path = require("path");
var env = require("./environment");

var serveFile = require("./serve-file");
var parseCookies = require("./parse-cookies");
var GithubAuth = require("./auth/github");
var websocket = require("./websocket");
var JsonApps = require("q-io/http-apps/json");
var sanitize = require("./sanitize");
var checkSession = require("./check-session");
var LogStackTraces = require("./log-stack-traces");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.client) throw new Error("options.client required");
    var client = options.client;
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.clientServices) throw new Error("options.clientServices required");
    var clientServices = options.clientServices;
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.directory) throw new Error("options.directory required");
    var directory = options.directory;
    if (!options.minitPath) throw new Error("options.minitPath required");
    var minitPath = options.minitPath;
    //jshint +W116

    return fs.exists(client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + client + "' does not exist");
        }

        var clientPath = path.normalize(path.join(__dirname, client));
        log("Filament client path", clientPath);

        var index = fs.join(client, "firefly-index.html");
        var serveApp = serveFile(index, "text/html", fs);

        var chain = joey
        .error()
        .log(httpLog, function (message) { return message; })
        .use(LogStackTraces(httpLog))
        .parseQuery()
        .tap(parseCookies)
        .use(sessions)
        .route(function (route) {
            // Public routes only

            route("").terminate(serveFile(fs.join(client, "login", "index.html"), "text/html", fs));
            route("favicon.ico").terminate(serveFile(fs.join(client, "favicon.ico"), "image/x-icon", fs));

            route("app/adaptor/client/...").fileTree(fs.join(__dirname, "inject", "adaptor", "client"));

            route("app").terminate(serveApp);
            route("app/...").fileTree(client, {fs: fs});
            // FIXME: Some CSS has /assets hard coded, so lets just serve from
            // the root for the moment
            route("assets/...").fileTree(fs.join(client, "assets"), {fs: fs});

            route("auth/...").route(function (route) {
                route("github/...").route(GithubAuth);
            });
        })
        //////////////////////////////////////////////////////////////////////
        .use(checkSession)
        //////////////////////////////////////////////////////////////////////
        .route(function (route) {
            // Private/authenticated routes
            route("logout")
            .tap(function (request) {
                return sessions.destroy(request.session);
            })
            .redirect(env.getAppUrl());

            route("projects").terminate(serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs));

            route(":owner/:repo/init")
            .methods(function (method) {
                method("POST")
                .use(setupProjectWorkspace(directory, minitPath))
                .app(function (request) {
                    return handleEndpoint(request, function() {
                        return request.projectWorkspace.initializeWorkspace();
                    }, function() {
                        return {message: "initialized"};
                    });
                });
            });

            route(":owner/:repo/components")
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

            route(":owner/:repo/modules")
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

            route(":owner/:repo/flush")
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

            route(":owner/:repo/workspace")
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

            // Must be last, as this is the most generic
            route(":owner/:repo")
            .methods(function (method) {
                method("PUT")
                .use(setupProjectWorkspace(directory, minitPath))
                .app(function (request) {
                    return handleEndpoint(request, function(data) {
                        return request.projectWorkspace.saveFile(
                            data.filename, data.contents);
                    }, function() {
                        return {message: "saved"};
                    });
                });

                method("GET").terminate(serveApp);
            });
        });

        // These services should be customized per websocket connection, to
        // encompass the session information
        var services = {};
        Object.keys(clientServices).forEach(function (name) {
            services[name] = require("./"+fs.join(client, clientServices[name]));
        });
        services["file-service"] = require("./services/file-service");
        services["extension-service"] = require("./services/extension-service");
        services["env-service"] = require("./services/env-service");
        services["package-manager-service"] = require("./services/package-manager-service");

        var websocketServer = websocket(sessions, services, clientPath);

        chain.upgrade = function (request, socket, head) {
            websocketServer.handleUpgrade(request, socket, head);
        };

        return chain;
    });
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
        return JsonApps.json(createMessage({
            error: reason.message
        }));
    });
}
