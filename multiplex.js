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
                if (endsWith(hostname, environment.project.hostname)) {
                    return projectHandler(request);
                } else {
                    // Fall back to app handler as HAProxy doesn't send the
                    // Host header from the original request
                    return appHandler(request);
                }
            };
        })
        .listen(environment.port)
        .then(function (server) {
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
