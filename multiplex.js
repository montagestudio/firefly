var log = require("logging").from(__filename);
var environment = require("./environment");
var Q = require("q");
var URL = require("url");
var joey = require("joey");
var Status = require("q-io/http-apps/status");

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
                return selectChain(request, function() {
                    return appHandler(request);
                }, function() {
                    return projectHandler(request);
                });
            };
        })
        .listen(environment.port)
        .then(function (server) {
            server.node.on("upgrade", function (request, socket, head) {
                return selectChain(request, function() {
                    appChain.upgrade(request, socket, head);
                }, function() {
                    projectChain.upgrade(request, socket, head);
                });
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

function selectChain(request, appCallback, projectCallback) {
    var hostname;

    if (request.hostname) {
        hostname = request.hostname;
    } else {
        var url = URL.parse("http://" + request.headers.host);
        hostname = url.hostname;
    }

    if (environment.matchesAppHostname(hostname)) {
        return appCallback();
    } else if (environment.matchesProjectHostname(hostname)) {
        return projectCallback();
    } else {
        log("*Unrecognized hostname*", hostname, "expected", environment.app.hostname, "or", environment.project.hostname);
        return Status.notAcceptable(request);
    }
}

// for testing
module.exports.selectChain = selectChain;