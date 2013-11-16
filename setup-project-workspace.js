var ProjectWorkspace = require("./project-workspace");

module.exports = SetupProjectWorkspace;

function SetupProjectWorkspace(fs, directory) {
    return function(next) {
        return function(request, response) {
            request.projectWorkspace = new ProjectWorkspace(fs, directory, request.session);
            return next(request, response);
        };
    };
}