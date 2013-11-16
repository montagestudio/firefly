var Q = require("q");
var joey = require("joey");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");

var parseCookies = require("./parse-cookies");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.session) throw new Error("options.session required");
    var session = options.session;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.directory) throw new Error("options.directory required");
    var directory = options.directory;
    //jshint +W116

    return Q.resolve(joey
    .tap(parseCookies)
    .use(session)
    .cors("*", "*", "*")
    .use(checkSession)
    .use(setupProjectWorkspace(fs, directory))
    .methods(function(method) {
        method("GET")
        .app(function(request) {
            var username = request.session.username;

            return fs.reroot(fs.join(directory, username)).then(function(fs) {
                return fs.isFile(request.path).then(function(isFile) {
                    if (isFile) {
                        return HttpApps.file(request, request.path, null, fs);
                    } else {
                        return StatusApps.notFound(request);
                    }
                });
            });
        });

    }));
}

