var Q = require("q");
var joey = require("joey");
var path = require("path");

var serveFile = require("./serve-file");
var parseCookies = require("./parse-cookies");
var GithubAuth = require("./auth/github");
var websocket = require("./websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.client) throw new Error("options.client required");
    var client = options.client;
    if (!options.session) throw new Error("options.session required");
    var session = options.session;
    if (!options.clientServices) throw new Error("options.clientServices required");
    var clientServices = options.clientServices;
    //jshint +W116

    return fs.exists(client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + client + "' does not exist");
        }

        global.clientPath = path.normalize(path.join(__dirname, client));
        console.log("Filament client path", global.clientPath);

        var index = fs.join(client, "index.html");
        var serveApp = serveFile(index, "text/html", fs);

        var chain = joey
        // .log()
        .error(true) // puts stack traces on error pages. TODO disable in production
        .parseQuery()
        .tap(parseCookies)
        .use(session)
        .route(function (route) {
            route("").terminate(serveFile(fs.join(client, "login", "index.html"), "text/html", fs));

            route("app/adaptor/client/...").fileTree(fs.join(__dirname, "inject", "adaptor", "client"));

            route("app").terminate(serveApp);
            route("app/...").fileTree(client, {fs: fs});
            // FIXME: Some CSS has /assets hard coded, so lets just serve from
            // the root for the moment
            route("assets/...").fileTree(fs.join(client, "assets"), {fs: fs});

            route("auth/...").route(function (route) {
                route("github/...").route(GithubAuth);
            });

            route("projects").terminate(serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs));

            // FIXME: remove this
            route("clone/...").fileTree(fs.join(__dirname, "..", "clone"));

            // Must be last, as this is the most generic
            route(":user/:repo/...").terminate(serveApp);

        });

        // These services should be customized per websocket connection, to
        // encompass the session information
        var services = Object.keys(clientServices).map(function (name) {
            return Q.master(require(fs.join(client, clientServices[name])));
        });
        services["file-services"] = Q.master(require(fs.join(__dirname, "services", "file-services")));
        services["extension-services"] = Q.master(require(fs.join(__dirname, "services", "extension-services")));

        var websocketServer = websocket(session, services);

        chain.upgrade = function (request, socket, head) {
            websocketServer.handleUpgrade(request, socket, head);
        };

        return chain;
    });
}
