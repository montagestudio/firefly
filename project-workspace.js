var log = require("logging").from(__filename);
var GithubApi = require("./inject/adaptor/client/core/github-api");
var Git = require("./git");
var Minit = require("./minit");
var path = require("path");

module.exports = ProjectWorkspace;

// TODO: receive owner/repo
function ProjectWorkspace(fs, directory, session, minitPath) {
    this._fs = fs;
    this._root = fs.join(directory, session.username);
    this._session = session;
    this._minitPath = minitPath;
    this._git = new Git(this._fs, this._session.githubAccessToken);
}

ProjectWorkspace.prototype.init = function() {
    // TODO: move this to session create
    return this._fs.makeTree(this._root);
};

ProjectWorkspace.prototype.getPath = function(pathname) {
    return this._fs.join(this._root, this._fs.resolve(pathname));
};

ProjectWorkspace.prototype.initRepository = function(owner, repo) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);
    var githubApi = new GithubApi(this._session.githubAccessToken);

    return githubApi.getRepository(owner, repo)
    .then(function(repository) {
        return self._git.isCloned(repoPath)
        .then(function(isCloned) {
            if (!isCloned) {
                return githubApi.isRepositoryEmpty(owner, repo)
                .then(function(isEmpty) {
                    if (isEmpty) {
                        //jshint -W106
                        return self.initEmptyRepository(
                            repository.clone_url, repository.default_branch,
                            owner, repo);
                        //jshint +W106
                    } else {
                        //jshint -W106
                        return self.cloneRepository(repository.clone_url, owner, repo);
                        //jshint +W106
                    }
                });
            }
        });
    });
};

/**
 * Creates the git config with the user name and email to be used for commits.
 */
ProjectWorkspace.prototype.setupRepositoryWorkspace = function(owner, repo) {
    var self = this,
        repoPath = this.getRepositoryPath(owner, repo),
        name = self._session.githubUser.name || self._session.githubUser.login,
        email = self._session.githubUser.email || "noreply";

    return this._git.config(repoPath, "user.name", name)
    .then(function() {
        return self._git.config(repoPath, "user.email", email);
    });
};

ProjectWorkspace.prototype.initEmptyRepository = function(repositoryUrl, repositoryBranch, owner, repo) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);
    var parentPath = path.normalize(this._fs.join(repoPath, ".."));
    var minit = new Minit(this._minitPath);

    log("init empty repository: " + repoPath);
    return this._fs.makeTree(parentPath)
    .then(function() {
        return minit.createApp(repo, parentPath);
    }).then(function() {
        return self._git.init(repoPath);
    }).then(function() {
        return self.setupRepositoryWorkspace(owner, repo);
    }).then(function() {
        return self._git.addRemote(repoPath, repositoryUrl);
    }).then(function() {
        return self._commitAllRepositoryFiles(owner, repo, "Initial commit");
    }).then(function() {
        return self._git.push(repoPath, repositoryUrl, repositoryBranch);
    });
};

ProjectWorkspace.prototype.cloneRepository = function(repositoryUrl, owner, repo) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);

    log("clone into: " + repoPath);
    return self._git.clone(repositoryUrl, repoPath)
    .then(function() {
        return self.setupRepositoryWorkspace(owner, repo);
    });
};

ProjectWorkspace.prototype.createComponent = function(owner, repo, name) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);
    var githubApi = new GithubApi(this._session.githubAccessToken);
    var minit = new Minit(this._minitPath);

    if (!name) {
        throw new Error("Name missing.");
    }

    log("create component in: " + repoPath);
    return minit.createComponent(name, repoPath)
    .then(function() {
        return self._commitAllRepositoryFiles(owner, repo, "Add component " + name);
    })
    .then(function() {
        return githubApi.getRepository(owner, repo);
    })
    .then(function(repository) {
        //jshint -W106
        return self._git.push(repoPath, repository.clone_url, repository.default_branch);
        //jshint +W106
    });
};

ProjectWorkspace.prototype.saveFile = function(owner, repo, filename, contents) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);
    var githubApi = new GithubApi(this._session.githubAccessToken);

    if (!filename) {
        throw new Error("Filename missing.");
    }

    if (!contents) {
        throw new Error("Contents missing.");
    }

    log("save file: " + repoPath + "/" + filename);
    return this._fs.reroot(repoPath)
    .then(function(fs) {
        return fs.write(filename, contents);
    })
    .then(function() {
        return self._commitAllRepositoryFiles(owner, repo, "Changed file " + filename);
    }).then(function() {
        return githubApi.getRepository(owner, repo);
    }).then(function(repository) {
        //jshint -W106
        return self._git.push(repoPath, repository.clone_url, repository.default_branch);
        //jshint +W106
    });
};

ProjectWorkspace.prototype._commitAllRepositoryFiles = function(owner, repo, message) {
    var self = this;
    var repoPath = this.getRepositoryPath(owner, repo);

    return this._git.add(repoPath, "--all")
    .then(function() {
        return self._git.commit(repoPath, message);
    });
};

ProjectWorkspace.prototype.getRepositoryPath = function(owner, repo) {
    return this.getPath(this._fs.join(owner, repo));
};