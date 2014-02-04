var log = require("logging").from(__filename);
var joey = require("joey");
var JsonApps = require("q-io/http-apps/json");

var sanitize = require("../sanitize");

module.exports = function (setupProjectWorkspace, directory, minitPath) {
    return joey.route(function (route) {
        route(":owner/:repo/...").route(function (route) {
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
    });
};

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
