var URL = require("url");

function Env(options) {
    var env = options || {  production: process.env.NODE_ENV === "production" };

    env.port = process.env.FIREFLY_PORT || 2440;

    env.app = URL.parse(process.env.FIREFLY_APP_URL || "http://local-firefly.declarativ.net:2440");
    // Remove `host` so that `URL.format` uses `hostname` and `port` instead.
    // Remove `pathname` so that `URL.format` doesn't add "/" to the end,
    // messing up the CORS Accept-Origin header.
    delete env.app.host;
    delete env.app.pathname;

    env.project = URL.parse(process.env.FIREFLY_PROJECT_URL || "http://local-project.127.0.0.1.xip.io:2440");
    delete env.project.host;
    delete env.project.pathname;

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
    env.getProjectPathFromSessionAndAppUrl = function (session, url) {
        var details = this.getDetailsFromAppUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
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

        var match = hostname.match(/([0-9a-z]+)-([0-9a-z\-]+)\./i);
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner.toLowerCase(),
            repo: repo.toLowerCase()
        };
    };
    env.getProjectUrlFromAppUrl = function (url) {
        var details = this.getDetailsFromAppUrl(url);
        var urlObj = Object.create(this.project);
        urlObj.hostname = details.owner + "-" + details.repo + "." + urlObj.hostname;
        return URL.format(urlObj);
    };
    env.getProjectPathFromSessionAndAppUrl = function (session, url) {
        var details = this.getDetailsFromAppUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
    };
    env.getProjectPathFromSessionAndProjectUrl = function (session, url) {
        var details = this.getDetailsfromProjectUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
    };
    /**
     * Assumes that the username is the same as the owner.
     * This is temporary while we build support for accessing repos that are not
     * forked to the user github.
     */
    env.getProjectPathFromProjectUrl = function (url) {
        var details = this.getDetailsfromProjectUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", details.owner, details.owner, details.repo);
    };

    env.getProjectHost = function() {
        return getHost(this.project.hostname, this.project.port);
    };

    // }
    return env;
}

function getHost(hostname, port) {
    return hostname + (port ? ":" + port : "");
}

module.exports = Env();
// for testing
module.exports.Env = Env;
module.exports.getHost = getHost;