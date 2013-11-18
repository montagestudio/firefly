var Env = require("./environment");
var Q = require("q");
var joey = require("joey");
var Status = require("q-io/http-apps/status");


module.exports = multiplex;
function multiplex(options, appChainFactory, appChainOptions, projectChainFactory, projectChainOptions) {

    if(Env.production) {
        return Q.all([
                appChainFactory(appChainOptions),
                projectChainFactory(projectChainOptions)
            ])
            .spread(function (appChain, projectChain) {

                var contraint = Constrain(Host).call(joey, Env.app.hostname+":*", Env.project.hostname+":*");

                var multiplex = Multiplex(Host).call(contraint, function (branch) {
                    branch(Env.app.hostname+":*").app(appChain.end());
                    branch(Env.project.hostname+":*").app(projectChain.end());
                });
                return multiplex
                    .listen(process.env.FIREFLY_APP_PORT)
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

//                return joey
//                    .host(Env.app.hostname+":*", Env.project.hostname+":*")
//                    .hosts(function (branch) {
//                        branch(Env.app.hostname+":*").app(appChain.end());
//                        branch(Env.project.hostname+":*").app(projectChain).end();
//                    })
//                    .listen(Env.app.port)
//                    .then(function (server) {
//                        return [
//                            {
//                                chain: appChain,
//                                server: server
//                            },
//                            {
//                                chain: projectChain,
//                                server: server
//                            }
//                        ];
//                    });
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


var Host = function (appForHost, notAcceptable) {
    var table = Object.keys(appForHost).map(function (pattern) {
        var parts = pattern.split(":");
        var hostname = parts[0];
        if(hostname) {
            // store part in reverse order
            var hostnameParts = hostname.split(".");
            hostname = [];
            var i = hostnameParts.length;
            while(i--) {
                hostname.push(hostnameParts[i]);
            }
        }
        return [
            pattern,
            hostname || ["*"],
            parts[1] || "*",
            appForHost[pattern]
        ];
    });
    if (!notAcceptable) {
        notAcceptable = Status.notAcceptable;
    }
    return function (request, response) {
        var matchHostname = function(hostname, requestHostname) {
            var hostnameParts = requestHostname.split(":")[0].split(".");
            var hostnameIndex = 0;
            var i = hostnameParts.length;
            var isMatch = true;
            while(i--) {
                 // check starting
                var part = hostname[hostnameIndex];
                if(part) {
                    if ( part === "*") {
                        break;
                    } else if( part !== hostnameParts[i]) {
                        isMatch = false;
                        break;
                    }
                } else {
                    isMatch = false;
                    break;
                }
                hostnameIndex++;
            }
            return isMatch;
        };
        // find first matching host for app
        for (var index = 0; index < table.length; index++) {
            var row = table[index]; // [hostname, port, app]
            var pattern = row[0];
            var hostname = row[1];
            var port = row[2];
            var app = row[3];
            if (
                matchHostname(hostname, request.hostname) &&
                (port === "*" || port === "" + request.port)
            ) {
                if (!request.terms) {
                    request.terms = {};
                }
                request.terms.host = pattern;
                return app(request, response);
            }
        }
        return notAcceptable(request, response);
    };
};


//Copied from joey

var Multiplex = function (Using) {
    return function (setup) {
        var branches = {};
        var chain = this;
        setup(function () {
            var branch = new chain.constructor();
            Array.prototype.forEach.call(arguments, function (name) {
                branches[name] = branch;
            });
            return branch;
        });
        return this.use(function (next) {
            Object.keys(branches).forEach(function (name) {
                var branch = branches[name];
                branches[name] = branch.end();
            });
            return Using(branches, next);
        });
    };
};

var Constrain = function (Using) {
    return function () {
        var args = arguments;
        var types = {};
        return this.use(function (next) {
            Array.prototype.forEach.call(args, function (type) {
                types[type] = next;
            });
            return Using(types);
        });
    };
};
