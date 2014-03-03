var log = require("logging").from(__filename);
var URL = require("url");
var routeProject; // Circular dependency, and so required once just before it's needed

function Env(options) {
    var env = options || {  production: process.env.NODE_ENV === "production" };

    log("production", env.production);

    env.port = process.env.FIREFLY_PORT || 2440;

    log("port", env.port);

    env.app = URL.parse(process.env.FIREFLY_APP_URL || "http://local-firefly.declarativ.net:2440");
    // Remove `host` so that `URL.format` uses `hostname` and `port` instead.
    // Remove `pathname` so that `URL.format` doesn't add "/" to the end,
    // messing up the CORS Accept-Origin header.
    delete env.app.host;
    delete env.app.pathname;

    log("app", JSON.stringify(env.app));

    env.project = URL.parse(process.env.FIREFLY_PROJECT_URL || "http://local-project.montagestudio.com:2440");
    delete env.project.host;
    delete env.project.pathname;

    log("project", JSON.stringify(env.project));

    env.projectServers = process.env.FIREFLY_PROJECT_SERVER_COUNT || 4;

    env.getAppHost = function() {
        return getHost(this.app.hostname, this.app.port);
    };

    env.getAppUrl = function () {
        return URL.format(this.app);
    };

    env.getDetailsFromAppUrl = function (url) {
        var pathname = URL.parse(url).pathname;

        var match = pathname.match(/\/?([^\/]+)\/([^\/]+)/);
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner.toLowerCase(),
            repo: repo.toLowerCase()
        };
    };
    env.getDetailsFromAppUrl = function (url) {
        var pathname = URL.parse(url).pathname;

        var match = pathname.match(/\/?([^\/]+)\/([^\/]+)/);
        if (!match) {
            throw new Error("Could not parse details from " + url);
        }
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner.toLowerCase(),
            repo: repo.toLowerCase()
        };
    };
    env.getDetailsfromProjectUrl = function (url) {
        // Needed because node's URL.parse interprets
        // a.b.c.com:1234
        // as
        // protocol: "a.b.c.d.com"
        // hostname: "2440"
        if (!/^https?:\/\//.test(url)) {
            url = "http://" + url;
        }
        var hostname = URL.parse(url).hostname;

        var match = hostname.match(/[0-9]-([0-9a-z]+)-([0-9a-z\-]+)\./i);
        if (!match) {
            throw new Error("Could not parse details from " + url);
        }
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner.toLowerCase(),
            repo: repo.toLowerCase()
        };
    };
    env.getProjectUrlFromAppUrl = function (url) {
        // see note at top of file
        if (!routeProject) {
            routeProject = require("./route-project");
        }

        var details = this.getDetailsFromAppUrl(url);
        var pod = routeProject.podForUsername(details.owner);

        var urlObj = Object.create(this.project);
        urlObj.hostname = pod + "-" + details.owner + "-" + details.repo + "." + urlObj.hostname;

        return URL.format(urlObj);
    };

    env.getProjectHost = function() {
        return getHost(this.project.hostname, this.project.port);
    };

    return env;
}

function getHost(hostname, port) {
    return hostname + (port ? ":" + port : "");
}

module.exports = Env();
// for testing
module.exports.Env = Env;
module.exports.getHost = getHost;
