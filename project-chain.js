var Q = require("q");
var joey = require("joey");

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
    .fileTree(directory, {fs: fs}));
    .use(checkSession)
    .use(setupProjectWorkspace(fs, directory))
}
