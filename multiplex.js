var log = require("logging").from(__filename);
var environment = require("./environment");
var Q = require("q");
var joey = require("joey");
var Status = require("q-io/http-apps/status");

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

module.exports = multiplex;
function multiplex(options, appChainFactory, appChainOptions, projectChainFactory, projectChainOptions) {
    return Q.all([
        appChainFactory(appChainOptions),
        projectChainFactory(projectChainOptions)
    ])
    .spread(function (appChain, projectChain) {
        var appHandler = appChain.end();
        var projectHandler = projectChain.end();
        return joey.use(function (next) {
            return function (request) {
                var hostname = request.hostname;
                if (endsWith(hostname, environment.app.hostname)) {
                    return appHandler(request);
                } else if (endsWith(hostname, environment.project.hostname)) {
                    return projectHandler(request);
                } else {
                    log("*Unrecognized hostname*", hostname, "expected", environment.app.hostname, "or", environment.project.hostname);
                    return Status.notAcceptable(request);
                }
            };
        })
        .listen(environment.port)
        .then(function (server) {
            server.node.on("upgrade", function (request, socket, head) {
                var host = request.headers.host;

                if (endsWith(host, environment.getAppHost())) {
                    appChain.upgrade(request, socket, head);
                } else if (endsWith(host, environment.getProjectHost())) {
                    projectChain.upgrade(request, socket, head);
                } else {
                    log("*Unrecognized hostname*", host, "expected", environment.getAppHost(), "or", environment.getProjectHost());
                    return Status.notAcceptable(request);
                }
            });

            return [
                {
                    chain: appChain,
                    server: server
                },
                {
                    chain: projectChain,
                    server: server
                }
            ];
        });
    });
}
