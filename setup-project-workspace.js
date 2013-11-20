var ProjectWorkspace = require("./project-workspace");
var sanitize = require("./sanitize");
var fs = require("q-io/fs");

module.exports = SetupProjectWorkspace;

function SetupProjectWorkspace(directory, minitPath) {
    return function(next) {
        return function(request, response) {
            var session = request.session,
                owner = sanitize.sanitizeDirectoryName(request.params.owner),
                repo = sanitize.sanitizeDirectoryName(request.params.repo),
                workspacePath = fs.join(directory, session.username, owner, repo);

            request.projectWorkspace = new ProjectWorkspace(session, workspacePath, owner, repo, minitPath);

            return next(request, response);
        };
    };
}