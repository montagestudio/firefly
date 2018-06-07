var ProjectWorkspace = require("./project-workspace");

module.exports = (config, directory, minitPath) => (request) => {
    const owner = config.owner.toLowerCase();
    const repo = config.repo.toLowerCase();
    request.projectWorkspace = new ProjectWorkspace(config, directory, owner, repo, minitPath);
};
