var ProjectWorkspace = require("./project-workspace");

module.exports = SetupProjectWorkspace;

function SetupProjectWorkspace(config, directory, minitPath) {
    return function (request, response) {
        var owner = config.owner.toLowerCase();
        var repo = config.repo.toLowerCase();

        request.projectWorkspace = new ProjectWorkspace(config, directory, owner, repo, minitPath);
    };
}
