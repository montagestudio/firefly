var log = require("logging").from(__filename);
var ProjectWorkspace = require("./project-workspace");
var sanitize = require("../sanitize");
var fs = require("q-io/fs");

module.exports = SetupProjectWorkspace;

function SetupProjectWorkspace(directory, minitPath) {
    return function(next) {
        return function(request, response) {
            var session = request.session;
            var owner = sanitize.sanitizeDirectoryName(request.params.owner).toLowerCase();
            var repo = sanitize.sanitizeDirectoryName(request.params.repo).toLowerCase();

            var userOwnerPath = fs.join(directory, session.username, owner);
            var workspacePath = fs.join(userOwnerPath, repo);

            return fs.exists(userOwnerPath)
            .then(function (exists) {
                if (!exists) {
                    log("creating user/owner directory:", userOwnerPath);
                    return fs.makeTree(userOwnerPath, "700"); // -rwx------
                }
            })
            .then(function () {
                request.projectWorkspace = new ProjectWorkspace(session, workspacePath, owner, repo, minitPath);
                return next(request, response);
            });
        };
    };
}
