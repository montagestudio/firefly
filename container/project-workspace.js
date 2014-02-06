var log = require("logging").from(__filename);
var PATH = require("path");
var Q = require("q");
var GithubApi = require("../inject/adaptor/client/core/github-api");
var Minit = require("./minit");
var Git = require("./git");
var fs = require("q-io/fs");
var PackageManagerService = require("./services/package-manager-service");

var INITIAL_COMMIT_MSG = "Initial commit";
var DEFAULT_GIT_EMAIL = "noreply";

module.exports = ProjectWorkspace;

/**
 * This object represents a project workspace and provides the operations needed
 * to intialize it and manage it.
 * A project workspace is a directory will all the files of a specific project.
 * The workspace can be initialized from a remote git repository or it can be
 * created from scratch and pushed to a remote git repository. Either way, the
 * workspace is meant to be synchronized with a remote git repository.
 *
 * The operations provided are:
 * - Initialize the workspace
 * - Save a file to the workspace
 * - Create a montage component and add it to the workspace
 * - Create a montage module and add it to the workspace
 * - Flush the workspace (sends all local changes to the remote git repository)
 */
function ProjectWorkspace(session, workspacePath, owner, repo, minitPath) {
    this._fs = fs;
    this._session = session;
    this._workspacePath = workspacePath;
    this._owner = owner;
    this._repo = repo;

    this._gitUrl = null;
    this._gitBranch = null;

    this._minitPath = minitPath;
}

Object.defineProperties(ProjectWorkspace.prototype, {
    __git: {
        writable: true,
        value: null
    },
    _git: {
        get: function() {
            if (!this.__git) {
                this.__git = new Git(this._fs, this._session.githubAccessToken);
            }

            return this.__git;
        }
    },

    __githubApi: {
        writable: true,
        value: null
    },

    _githubApi: {
        get: function() {
            if (!this.__githubApi) {
                this.__githubApi = new GithubApi(this._session.githubAccessToken);
            }

            return this.__githubApi;
        }
    }
});

/**
 * Workspace setup operations
 */
ProjectWorkspace.prototype._info = null;
ProjectWorkspace.prototype.getInfo = function() {
    if (!this._info) {
        var deferred = Q.defer();
        this._info = deferred.promise;
        this._githubApi.getRepository(this._owner, this._repo)
        .then(function(repository) {
            deferred.resolve({
                //jshint -W106
                gitUrl: repository.clone_url,
                gitBranch: repository.default_branch
                //jshint +W106
            });
        })
        .fail(deferred.reject);
    }

    return this._info;
};

ProjectWorkspace.prototype.existsWorkspace = function() {
    return this._fs.exists(this._workspacePath);
};

ProjectWorkspace.prototype.initializeWorkspace = function() {
    var self = this;

    return this._githubApi.isRepositoryEmpty(this._owner, this._repo)
    .then(function(isEmpty) {
        if (isEmpty) {
            return self.initializeWithEmptyProject();
        } else {
            return self.initializeWithRepository();
        }
    });
};

/**
 * Initializes the workspace by creating an empty app and pushing it to the
 * remote repository.
 */
ProjectWorkspace.prototype.initializeWithEmptyProject = function() {
    var self = this;
    var parentPath = PATH.normalize(this._fs.join(this._workspacePath, ".."));
    var minit = new Minit(this._minitPath);

    return minit.createApp(parentPath, self._repo)
    .then(function() {
        return self._git.init(self._workspacePath);
    }).then(function() {
        return self.getInfo();
    }).then(function(info) {
        return self._git.addRemote(self._workspacePath, info.gitUrl);
    }).then(function() {
        return self._setupWorkspaceRepository();
    }).then(function() {
        return self.flushWorkspace(INITIAL_COMMIT_MSG);
    });
};

/**
 * Initializes the workspace by cloning the remote repository.
 */
ProjectWorkspace.prototype.initializeWithRepository = function() {
    var self = this;

    return this.getInfo()
    .then(function(info) {
        return self._git.clone(info.gitUrl, self._workspacePath);
    })
    .then(function() {
        return self._setupWorkspaceRepository();
    });
};

/**
 * File related operations
 */

ProjectWorkspace.prototype.saveFile = function(filename, contents) {
    if (!filename) {
        throw new Error("Filename missing.");
    }

    if (!contents) {
        throw new Error("Contents missing.");
    }

    log("save file: " + this._workspacePath + "/" + filename);
    return this._fs.reroot(this._workspacePath)
    .then(function(fs) {
        return fs.write(filename, contents);
    })
    .fail(function() {
        throw new Error("Save file failed.");
    });
};

/**
 * Montage related operations
 */

ProjectWorkspace.prototype.createComponent = function(name) {
    var self = this;
    var minit = new Minit(this._minitPath);

    if (!name) {
        throw new Error("Name missing.");
    }

    log("create component in: " + this._workspacePath);
    return minit.createComponent(this._workspacePath, name)
    .then(function() {
        return self.flushWorkspace("Add component " + name);
    });
};

ProjectWorkspace.prototype.createModule = function(name, extendsModuleId, extendsName) {
    var self = this;
    var minit = new Minit(this._minitPath);

    if (!name) {
        throw new Error("Name missing.");
    }

    log("create module in: " + this._workspacePath);
    return minit.createModule(this._workspacePath, name, extendsModuleId, extendsName)
    .then(function() {
        return self.flushWorkspace("Add module " + name);
    });
};

/**
 * Git related operations
 */

/**
 * Creates a single commit with all changes in the workspace and pushes it to
 * the default remote.
 */
ProjectWorkspace.prototype.flushWorkspace = function(message) {
    var self = this;

    return this._commitWorkspace(message)
    .then(function() {
        return self._pushWorkspace();
    });
};

/**
 * Push all commits to the default remote.
 */
ProjectWorkspace.prototype._pushWorkspace = function(message) {
    var self = this;

    return this.getInfo()
    .then(function(info) {
        return self._git.push(self._workspacePath, info.gitUrl, info.gitBranch);
    });
};

/**
 * Creates a commit with all modified files.
 */
ProjectWorkspace.prototype._commitWorkspace = function(message) {
    var self = this;

    return this._git.add(this._workspacePath, "--all")
    .then(function() {
        return self._git.commit(self._workspacePath, message);
    });
};

/**
 * Creates the git config with the user name and email to be used for commits.
 * Installs the needed node modules.
 */
ProjectWorkspace.prototype._setupWorkspaceRepository = function() {
    var self = this;
    return this._session.githubUser.then(function (githubUser) {
        var name = githubUser.name || githubUser.login;
        var email = githubUser.email || DEFAULT_GIT_EMAIL;

        return self._git.config(self._workspacePath, "user.name", name)
        .then(function() {
            return self._git.config(self._workspacePath, "user.email", email);
        });
    })
    .then(function() {
        return self._npmInstall();
    });
};

/**
 * NPM related operations
 */
ProjectWorkspace.prototype._npmInstall = function () {
    // Let the PackageManager installs the project's dependencies.
    var pathname =  PATH.sep + this._fs.join(this._owner, "/" + this._repo),
        fsPath = this._workspacePath;

    return this._fs.reroot(this._workspacePath)
    .then(function(fs) {
        var service = PackageManagerService(fs, null, pathname, fsPath);
        return service.installProjectPackages();
    });
};


