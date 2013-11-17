var Env = require("./environment");
var Q = require("q");
var joey = require("joey");


module.exports = multiplex;
function multiplex(options, appChainFactory, appChainOptions, projectChainFactory, projectChainOptions) {

    if(Env.production) {
        return Q.all([
                appChainFactory(appChainOptions),
                projectChainFactory(projectChainOptions)
            ])
            .spread(function (appChain, projectChain) {
                return joey.host(Env.app.hostname+":*", Env.project.hostname+":*")
                    .hosts(function (branch) {
                        branch(Env.app.hostname+":*").app(appChain.end());
                        branch(Env.project.hostname+":*").app(projectChain).end();
                    })
                    .listen(Env.app.port)
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
