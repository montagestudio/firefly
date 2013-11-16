var log = require("logging").from(__filename);
var GithubApi = require("./inject/adaptor/client/core/github-api");
var Git = require("./git");

module.exports = ProjectWorkspace;

function ProjectWorkspace(fs, directory, session) {
    this._fs = fs;
    this._root = fs.join(directory, session.username);
    this._session = session;
}

ProjectWorkspace.prototype.getPath = function(pathname) {
    return this._fs.join(this._root, this._fs.resolve(pathname));
};

ProjectWorkspace.prototype.initRepository = function(owner, repo) {
    var repoPath = this.getRepositoryPath(owner, repo);
    var githubApi = new GithubApi(this._session.githubAccessToken);
    var git = new Git(this._fs, this._session.githubAccessToken);

    return githubApi.getRepository(owner, repo)
    .then(function(repository) {
        return git.isCloned(repoPath)
        .then(function(isCloned) {
            if (!isCloned) {
                return githubApi.isRepositoryEmpty(owner, repo)
                .then(function(isEmpty) {
                    if (isEmpty) {
                        log("init empty repository: " + repoPath);
                        return git.init(repoPath).then(function() {
                            //jshint -W106
                            return git.addRemote(repoPath, repository.clone_url);
                            //jshint +W106
                        }).then(function() {
                            // minit
                            return git.add(repoPath, "--all");
                        }).then(function() {
                            //jshint -W106
                            return git.push(repoPath, repository.default_branch);
                            //jshint +W106
                        });
                    } else {
                        log("clone into: " + repoPath);
                        //jshint -W106
                        return git.clone(repository.clone_url, repoPath);
                        //jshint +W106
                    }
                });
            }
        });
    });
};

ProjectWorkspace.prototype.getRepositoryPath = function(owner, repo) {
    return this.getPath(this._fs.join(owner, repo));
};