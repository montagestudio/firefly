var Q = require("q");
var joey = require("joey");

var production = process.env.NODE_ENV;
var appHost = process.env.APP_HOST || "localhost:*";
var projectHost = process.env.PROJECT_HOST || "127.0.0.1:*";

module.exports = multiplex;
function multiplex(options, appChainFactory, appChainOptions, projectChainFactory, projectChainOptions) {

    if(production) {
        return Q.all([
                appChainFactory(appChainOptions),
                projectChainFactory(projectChainOptions)
            ])
            .spread(function (appChain, projectChain) {
                return joey.host(appHost, projectHost)
                    .hosts(function (branch) {
                        branch(appHost).app(appChain.end());
                        branch(projectHost).app(projectChain).end();
                    })
                    .listen(2440)
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
    } else {
        return Q.all([
            appChainFactory(appChainOptions)
            .then(function (chain) {
                return chain.listen(options["app-port"]).then(function (server) {
                    return {
                        chain: chain,
                        server: server
                    };
                });
            }),
            projectChainFactory(projectChainOptions)
            .then(function (chain) {
                return chain.listen(options["project-port"]).then(function (server) {
                    return {
                        chain: chain,
                        server: server
                    };
                });
            })
        ]);
    }


    // TODO: multiplex based on request.headers.host, instead of starting
    // two servers on different ports
}
