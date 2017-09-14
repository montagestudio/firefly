var log = require("../logging").from(__filename);
var track = require("../track");
var PATH = require("path");
var Minit = require("./minit");
var RepositoryService = require("./services/repository-service").service;
var fs = require("q-io/fs");
var PackageManagerService = require("./services/package-manager-service");

var INITIAL_COMMIT_MSG = "Initial commit";
var UPDATE_DEPENDENCIES_MSG = "Update dependencies";
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
function ProjectWorkspace(config, workspacePath, owner, repo, minitPath, githubApi) {
    this._fs = fs;
    this._config = config;
    this._workspacePath = workspacePath;
    this._owner = owner;
    this._repo = repo;
    this._githubApi = githubApi;

    this._minitPath = minitPath;
}

Object.defineProperties(ProjectWorkspace.prototype, {
    __repoService: {
        writable: true,
        value: null
    },
    _repoService: {
        get: function() {
            if (!this.__repoService) {
                this.__repoService = RepositoryService(this._config.username, this._owner, this._config.githubAccessToken, this._repo, this._fs, this._workspacePath, true, this._githubApi);
            }
            return this.__repoService;
        }
    }
});

/**
 * Workspace setup operations
 */
ProjectWorkspace.prototype.existsWorkspace = function() {
    return this._fs.exists(this._fs.join(this._workspacePath, ".git"));
};

ProjectWorkspace.prototype.existsNodeModules = function() {
    return this._fs.exists(this._fs.join(this._workspacePath, "node_modules"));
};

ProjectWorkspace.prototype.initializeWorkspace = function() {
    var self = this;

    return this.existsWorkspace().then(function (exists) {
        if (!exists) {
            return self._repoService.isProjectEmpty()
            .then(function(isEmpty) {
                if (isEmpty) {
                    return self.initializeWithEmptyProject();
                } else {
                    return self.initializeWithRepository();
                }
            });
        }
    });
};

/**
 * Initializes the workspace by creating an empty app and pushing it to the
 * remote repository.
 */
ProjectWorkspace.prototype.initializeWithEmptyProject = function() {
    var self = this;
    var minit = new Minit(this._minitPath);

    return minit.createApp(this._workspacePath, self._repo)
    .then(function() {
        return self._repoService.setupProject();
    })
    .then(function() {
        return self._setupWorkspaceRepository();
    })
    .then(function() {
        return self._repoService.commitFiles(null, INITIAL_COMMIT_MSG);
    })
    .then(function() {
        return self._repoService._flush();
    })
    .then(function() {
        return self._repoService.defaultBranchName()
        .then(function(branch) {
            return self._repoService.checkoutShadowBranch(branch);
        });
    });
};

/**
 * Initializes the workspace by cloning the remote repository.
 */
ProjectWorkspace.prototype.initializeWithRepository = function() {
    var self = this;

    return this._repoService.cloneProject()
    .then(function() {
        return self._repoService.defaultBranchName()
        .then(function(branch) {
            return self._repoService.checkoutShadowBranch(branch);
        });
    })
    .then(function() {
        return self._setupWorkspaceRepository();
    })
    .then(function() {
        return self._repoService.commitFiles(null, UPDATE_DEPENDENCIES_MSG);
    })
    .then(function() {
        return self._repoService._flush();
    });
};

ProjectWorkspace.prototype.initializeWithTemplate = function(templateDirectory) {
    var self = this;

    return this.existsWorkspace().then(function (exists) {
        if (!exists) {
            return self._repoService.cloneTemplate(templateDirectory)
            .then(function () {
                return self._repoService.checkoutShadowBranch("master");
            })
            .then(function() {
                return self._setupWorkspaceRepository();
            });
        }
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
    .fail(function(error) {
        track.error(error);
        throw new Error("Save file failed.");
    });
};

/**
 * Montage related operations
 */

ProjectWorkspace.prototype.createComponent = function(name, destination) {
    var self = this;
    var minit = new Minit(this._minitPath);

    if (!name) {
        throw new Error("Name missing.");
    }
    log("create component in: " , this._workspacePath + (destination)? "/" + destination : "");
    return minit.createComponent(this._workspacePath, name, destination)
    .then(function() {
        return self.flushWorkspace("Add component " + name);
    });
};

ProjectWorkspace.prototype.createModule = function(name, extendsModuleId, extendsName, destination) {
    var self = this;
    var minit = new Minit(this._minitPath);

    if (!name) {
        throw new Error("Name missing.");
    }

    log("create module in: " , this._workspacePath);
    return minit.createModule(this._workspacePath, name, extendsModuleId, extendsName, destination)
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

    return this._repoService.commitFiles(null, message)
    .then(function() {
        return self._repoService._flush();
    });
};

/**
 * Creates the git config with the user name and email to be used for commits.
 * Installs the needed node modules.
 */
ProjectWorkspace.prototype._setupWorkspaceRepository = function() {
    var self = this;
    var githubUser = this._config.githubUser;
    var name = githubUser.name || githubUser.login;
    var email = githubUser.email || DEFAULT_GIT_EMAIL;

    return this._repoService.setUserInfo(name, email)
    .then(function() {
        return self._npmInstall();
    });
};

/**
 * NPM related operations
 */
ProjectWorkspace.prototype._npmInstall = function () {
    // Let the PackageManager installs the project's dependencies.
    var pathname =  PATH.sep + PATH.join(this._owner, this._repo),
        fsPath = this._workspacePath;

    return this._fs.reroot(this._workspacePath)
    .then(function(fs) {
        var service = PackageManagerService(null, fs, null, pathname, fsPath);
        return service.installProjectPackages();
    });
};
