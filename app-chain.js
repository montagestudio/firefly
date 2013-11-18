var log = require("logging").from(__filename);
var httpLog = require("logging").from("app-joey");
var joey = require("joey");
var path = require("path");

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

        global.clientPath = path.normalize(path.join(__dirname, client));
        log("Filament client path", global.clientPath);

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

            route("projects").terminate(serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs));

            route(":owner/:repo/init")
            .methods(function (method) {
                method("POST")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return handleEndpoint(request, function(owner, repo) {
                        return request.projectWorkspace.initRepository(
                            owner, repo);
                    }, function() {
                        return {message: "initialized"};
                    });
                });
            });

            route(":owner/:repo/components")
            .methods(function (method) {
                method("POST")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return request.body.read()
                    .then(function(body) {
                        var options = JSON.parse(body.toString());

                        return handleEndpoint(request, function(owner, repo) {
                            return request.projectWorkspace.createComponent(
                                owner, repo, options.name);
                        }, function() {
                            return {message: "created"};
                        });
                    });
                });
            });

            route(":owner/:repo/modules")
            .methods(function (method) {
                method("POST")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return request.body.read()
                    .then(function(body) {
                        var options = JSON.parse(body.toString());

                        return handleEndpoint(request, function(owner, repo) {
                            return request.projectWorkspace.createModule(
                                owner, repo, options.name,
                                options.extendsModuleId, options.extendsName);
                        }, function() {
                            return {message: "created"};
                        });
                    });
                });
            });

            route(":owner/:repo/flush")
            .methods(function (method) {
                method("POST")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return request.body.read()
                    .then(function(body) {
                        var options = JSON.parse(body.toString());

                        return handleEndpoint(request, function(owner, repo) {
                            return request.projectWorkspace.flushRepository(
                                owner, repo, options.message);
                        }, function() {
                            return {message: "flushed"};
                        });
                    });
                });
            });

            route(":owner/:repo/workspace")
            .methods(function (method) {
                method("GET")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return handleEndpoint(request, function(owner, repo) {
                        return request.projectWorkspace.existsRepository(
                            owner, repo);
                    }, function(exists) {
                        return {created: exists};
                    });
                });
            });

            // Must be last, as this is the most generic
            route(":owner/:repo")
            .methods(function (method) {
                method("PUT")
                .use(setupProjectWorkspace(fs, directory, minitPath))
                .app(function (request) {
                    return request.body.read()
                    .then(function(body) {
                        var options = JSON.parse(body.toString());

                        return handleEndpoint(request, function(owner, repo) {
                            return request.projectWorkspace.saveFile(
                                owner, repo,
                                options.filename, options.contents);
                        }, function() {
                            return {message: "saved"};
                        });
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

        var websocketServer = websocket(sessions, services);

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

    return endpointCallback(owner, repo)
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
