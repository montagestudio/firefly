var URL = require("url");

function Env(options) {
    var env = options || {  production: process.env.NODE_ENV === "production" };
    env.getAppUrl = function () {
        return URL.format(this.app);
    };

    //App works the same on dev and production
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

    // PRODUCTION
    if ( env.production) {
        env.app = {
            hostname: process.env.FIREFLY_APP_HOST || "app.127.0.0.1.xip.io",
            protocol: process.env.FIREFLY_APP_PROTOCOL || "http"
        };
        env.project = {
            hostname: process.env.FIREFLY_PROJECT_HOST || "*.project.127.0.0.1.xip.io",
            protocol: process.env.FIREFLY_PROJECT_PROTOCOL || "http"
        };

        var projectList = [];
        var projectMemory = {};
        var projectIndex = -1;
        var projectInMemory = function addProject(project) {
            // first check if we already have a number
            return projectMemory[project.owner + "-" + project.repo];
        };
        var removeProjectInMemory = function addProject(project) {
            delete projectMemory[project.owner + "-" + project.repo] ;
        };
        var addProjectInMemory = function addProject(project, number) {
            projectMemory[project.owner + "-" + project.repo] = number;
        };

        var getProjectNumber = function addProject(project) {
            // first check if we already have a number
            var projectNumber = projectInMemory(project);

            if (projectNumber != null) {
                return projectNumber;
            }

            projectIndex++;
            if(projectIndex > 40) {
                projectIndex = 0;
            }
            // remove old one if one exists
            removeProjectInMemory(project);
            projectList[projectIndex] = project;
            // add new one if one exists
            addProjectInMemory(project, projectIndex);
            return projectIndex;
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

            var number = URL.parse(url).hostname.match(/p(\d+)\./i)[1];

            var project = projectList[parseInt(number, 10)];

            return {
                owner: project.owner.toLowerCase(),
                repo: project.repo.toLowerCase()
            };
        };
        env.getProjectUrlFromAppUrl = function (url) {
            var details = this.getDetailsFromAppUrl(url);
            var urlObj = Object.create(this.project);
            urlObj.hostname = "p" + getProjectNumber(details) + urlObj.hostname.substring(1, urlObj.hostname.length);
            return URL.format(urlObj);
        };
        env.getProjectPathFromSessionAndProjectUrl = function (session, url) {
            var details = this.getDetailsfromProjectUrl(url);

            // FIXME not to use FS
            var FS = require("q-io/fs");
            return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
        };

    } else {

        env.app = {
            hostname: "app.127.0.0.1.xip.io",
            port: 2440,
            protocol: "http"
        };
        env.project = {
            hostname: "project.127.0.0.1.xip.io",
            port: 2441,
            protocol: "http"
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

            var match = hostname.match(/([a-z\-]+)-([a-z]+)\./i);
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

    }
    return env;
}

module.exports = Env();
// for testing
module.exports.Env = Env;
