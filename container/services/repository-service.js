var Q = require("q");
var URL = require("url");
var Git = require("../git");
var GitCommitBatchFactory = require("../git-commit-batch");
var GithubApi = require("../../inject/adaptor/client/core/github-api");
var Frontend = require("../frontend");
var log = require("../../logging").from(__filename);

module.exports = exports = RepositoryService;   // High level access to the service
module.exports.service = _RepositoryService;    // Low level access to the service

// Constants to differentiate between local and remote sources, by default the remote source is 'origin' 
var LOCAL_SOURCE_NAME = "__local__";
var REMOTE_SOURCE_NAME = "origin";

var SHADOW_BRANCH_PREFIX = "montagestudio/";
var SHADOW_BRANCH_SUFFIX = "/";

// old shadow branch name constants for backward compatibility
var OLD_SHADOW_BRANCH_PREFIX = "__mb__";
var OLD_SHADOW_BRANCH_SUFFIX = "__";

var _cachedServices = {};
var semaphore = Git.semaphore;

var GIT_FETCH_TIMEOUT = 30 * 1000;  // 30 seconds
var AUTO_FLUSH_TIMEOUT = 5 * 1000;  // 5 seconds

var makeConvertProjectUrlToPath = exports.makeConvertProjectUrlToPath = function() {
    return function (url) {
        var path = URL.parse(url).pathname;

        if (path.charAt(0) === "/") {
            return URL.parse(url).pathname.substr(1);   // Remove the leading /
        } else {
            return URL.parse(url).pathname;
        }
    };
};

function RepositoryService(config, fs, environment, pathname, fsPath, _, githubApi) {
    return _RepositoryService(config.username, config.owner, config.githubAccessToken, config.repo, fs, fsPath, true, githubApi);
}

function _RepositoryService(username, owner, githubAccessToken, repo, fs, fsPath, acceptOnlyHttpsRemote, githubApi) {
    // Returned service

    var serviceUUID = username + ":" + owner + ":" + repo + ":" + fsPath;

    if (_cachedServices[serviceUUID]) {
        return _cachedServices[serviceUUID];
    } else {
        _cachedServices[serviceUUID] = {};
    }

    var service = _cachedServices[serviceUUID],
        _username = username,
        _owner = owner,
        _repo = repo,
        _accessToken = githubAccessToken,
        _fs = fs,
        _fsPath = fsPath,
        _convertProjectUrlToPath = makeConvertProjectUrlToPath(),
        _git = new Git(_fs, _accessToken, acceptOnlyHttpsRemote),
        _githubApi = githubApi || new GithubApi(_accessToken),
        _info = null,
        _githubPollTimer = null,
        _gitFetchLastTimeStamp = 0,
        _gitFetch,
        _gitAutoFlushTimer = [],
        _checkGithubError,
        _gitCommitBatch = GitCommitBatchFactory(service),
        USER_SHADOW_BRANCH_PREFIX;


    USER_SHADOW_BRANCH_PREFIX = SHADOW_BRANCH_PREFIX + _username + SHADOW_BRANCH_SUFFIX;

    _gitFetch = function(force) {
        if (force === true || (Date.now() - _gitFetchLastTimeStamp) > GIT_FETCH_TIMEOUT) {
            return _git.fetch(_fsPath, service.REMOTE_SOURCE_NAME, ["--prune"])
            .then(function() {
                _gitFetchLastTimeStamp = Date.now();
            });
        } else {
            return Q();
        }
    };

    _checkGithubError = function(method) {
        return _githubApi.checkError(method, owner, service);
    };

    /**
     * Set a GithuApi object
     *
     * Use this to setup a different GithubApi object than the default one provided by the service
     */
    service.setGithubApi = function(githubApi) {
        _githubApi = githubApi;
    };

    /**
     * Return true if the github project does not contain any file
     */
    service.isProjectEmpty = function() {
        return _githubApi.isRepositoryEmpty(_owner, _repo);
    };

    /**
     * Setup a brand new project
     */
    service.setupProject = _checkGithubError(semaphore.exclusive(function() {
        return this._setupProject();
    }));

    /**
     * setup a project by cloning it from github
     */
    service.cloneProject = _checkGithubError(semaphore.exclusive(function() {
        return this._cloneProject();
    }));

    /**
     * setup a project by cloning it from a local template
     */
    service.cloneTemplate = _checkGithubError(semaphore.exclusive(function(path) {
        return this._cloneTemplate(path);
    }));


    /**
     * Configure the git user information
     */
    service.setUserInfo = function(name, email) {
        return this._setUserInfo(name, email);
    };

    /**
     * Retrieve the github default branch for the current project
     */
    service.defaultBranchName = function() {
        return this._getInfo().then(function(info) {
            return info.gitBranch;
        });
    };

    /**
     * Retrieve information for the specified branch
     */
    service.getRepositoryInfo = function(branchName) {
        var self = this,
            info = {
                username: _username,
                owner: _owner,
                repository: _repo
            };

        return this._getRepositoryUrl().then(function(url) {
            // Trim the .git suffix
            var suffixPos = url.indexOf(".git");
            if (suffixPos !== -1) {
                url = url.substring(0, suffixPos);
            }
            info.repositoryUrl = url;
            return self._listBranches();
        })
        .then(function(result) {
            var branch = result.branches[LOCAL_SOURCE_NAME][branchName];

            info.branch = branch.name;
            info.shadowBranch = branch.shadow.name;
            return info;
        });
    };

    /**
     * Create a new commit batch
     */
    service.openCommitBatch = function(message) {
        return new _gitCommitBatch(message);
    };


    /**
     * Return an object describing all branches (local and remotes) as well the current
     * branch (checked out). If a shadow branch is checked out, current will represent
     * the name of the parent branch and the property currentIsShadow is set to true.
     *
     * Shadow branches are represented as an attribute of their parent branch and are
     * not listed on their own
     *
     * argument:
     *      forceFetch: [optional] pass true to force a fetch, else the service will decide if it needs to fetch or not
     *
     * return: promise for an branches object
     *
     * branches object format:
     * {
     *      current: <branch name>,
     *      currentIsShadow: <boolean>,
     *      branches: {
     *          <LOCAL_SOURCE_NAME>: [
     *              <branch name>: {
     *                  branchName: <branch name>,
     *                  sha: <sha>,
     *                  shadow: {
     *                      branchName: <branch name>,
     *                      sha: <sha>
     *                  }
     *              },
     *              ...
     *          ],
     *          <REMOTE_SOURCE_NAME>: [
     *              ...
     *          ],
     *          ...
     *      }
     * }
     */
    service.listBranches = _checkGithubError(semaphore.exclusive(function(forceFetch) {
        return this._listBranches(forceFetch);
    }));

    /**
     * Checkout the shadowbranch for the branch branch.
     *
     * If the shadow branch does not exist locally and / or remotely
     * the shadow branches are created.
     *
     * The parent branch does not have to exist locally but must be remotely.
     *
     * Call this method before using commitFiles or updateRefs.
     *
     * argument:
     *      branch: branch name to checkout (without shadow branch prefix)
     *
     * return: promise
     */
    service.checkoutShadowBranch = _checkGithubError(semaphore.exclusive(function(branch) {
        return this._checkoutShadowBranch(branch);
    }));

    /**
     * Return the status of the local shadow branch compared to the local
     * parent branch and the remote parent branch.
     *
     * argument:
     *      branch: branch name to checkout (without shadow branch prefix)
     *      forceFetch: [optional] pass true to force a fetch, else the service will decide if it needs to fetch or not
     *
     * return: promise for an status object
     *
     * status object format:
     * {
     *      localParent: {
     *          behind: <number>,
     *          ahead: <number>
     *      },
     *      remoteParent: {
     *          behind: <number>,
     *          ahead: <number>
     *      },
     *      remoteShadow: {
     *          behind: <number>,
     *          ahead: <number>
     *      }
     * }
    */
    service.shadowBranchStatus = _checkGithubError(semaphore.exclusive(function(branch, forceFetch) {
        return this._shadowBranchStatus(branch, forceFetch);
    }));

    /**
     * Commit files to the current branch and schedule a push to the
     * remote repository. Make sure to call checkoutShadowBranch before.
     *
     * argument:
     *                   files: Array of file's url, can pass null to
     *                          commit all files
     *                 message: [optional] text to use for the commit's message
     *                 remove : [optional] set to true to indicate a removal of files, must provide an Array or files
     *                   amend: [optional] set to true to amend the commit to the previous commit
     *
     * return: promise
     */
    service.commitFiles = _checkGithubError(semaphore.exclusive(function(fileUrls, message, remove, amend) {
        return this._commitFiles(fileUrls, message, remove, amend);
    }));

    /**
     * Commit a batch to the current branch and schedule a push to the
     * remote repository. Make sure to call checkoutShadowBranch before.
     *
     * return: promise
     */
    service.commitBatch = _checkGithubError(semaphore.exclusive(function(batch) {
        return this._commitBatch(batch);
    }));

    /**
     * Pushes the commits from the specified or current branch to the remote repository.
     *
     * return: promise
     */
    service.flush = _checkGithubError(semaphore.exclusive(function(branch) {
        return this._flush(branch);
    }));

    /**
     * Update References. Will keep in syncs the current branch as well its shadow branch.
     * If a conflict occurs, a resolution strategy can be provided.
     *
     * Make sure to call checkoutShadowBranch before and make sure there is not uncommitted
     * changes.
     *
     * updateRefs returns resolution strategies in case of a conflict and a reference to give back when resolving
     * conflicts
     *
     * Possible resolution strategy are:
     *  - "rebase":  Update the local repository by rebasing (could failed, check returned
     *               resolution strategies for alternatives.
     *  - "discard": Discard the local commit and update the local repository
     *               with the remote changes
     *  - "revert":  Revert the remote commits and push the local changes
     *  - "force":   Force push the local branch into the remote
     *
     * argument:
     *      resolutionStrategy:  [optional] resolution strategy to use to resolve conflict
     *      reference: [optional] reference object returned by previous call, must be provided when resolving a conflict
     *      forceFetch: [optional] pass true to force a fetch, else the service will decide if it needs to fetch or not
     *
     * return: promise for an object:
     *      {
     *          success: true or false
     *          [following only when success is false]
     *              local: local branch name
     *              remote: remote branch name (full name)
     *              ahead:  number of commits local branch is ahead of remote branch
     *              behind: number of commits local branch is behind of remote branch
     *              resolutionStrategy: Array of possible resolutions
     *              reference: reference object to pass back to resolve conflicts
     *      }
     */
    service.updateRefs = _checkGithubError(semaphore.exclusive(function(resolutionStrategy, reference, forceFetch) {
        return this._updateRefs(resolutionStrategy, reference, forceFetch);
    }));

    /**
     * Merge the Shadow branch into its parent and update the remote shadow and remote parent.
     *
     * Make sure to updateRefs and fix any potential conflict before merging.
     *
     * mergeShadowBranch returns true if the merge was successful (via a promise)
     *
     * argument:
     *      branch: the branch name to merge into (parent branch)
     *      message: merge commit message (only when squash is true)
     *      squash: true to squash the commits
     *
     * return: promise for an boolean
     */
    service.mergeShadowBranch = _checkGithubError(semaphore.exclusive(function(branch, message, squash) {
        return this._mergeShadowBranch(branch, message, squash);
    }));

    service._getInfo = function() {
        if (!_info) {
            _info = _githubApi.getInfo(_owner, _repo);
        }
        return _info;
    };

    service._getRepositoryUrl = function() {
        return service._getInfo()
        .then(function(info) {
            return _git._addAccessToken(info.gitUrl);
        });
    };

    service._setupProject = function() {
        var self = this;

        return _git.init(_fsPath)
        .then(function() {
            return self._getRepositoryUrl();
        }).then(function(gitUrl) {
            return _git.addRemote(_fsPath, gitUrl);
        });
    };

    service._cloneProject = function() {
        return this._getRepositoryUrl()
        .then(function(gitUrl) {
            return _git.clone(gitUrl, _fsPath);
        });
    };

    service._cloneTemplate = function(path) {
        var next;

        if (path.lastIndexOf(".git") ===  path.length - ".git".length) {
            var _localGit = new Git(_fs, _accessToken, false);  // Use _localGit only for cloning the template
            next = _localGit.clone(path, _fsPath);
        } else {
            log("copy tree");
            next =_fs.copyTree(path, _fsPath);
        }

        return Q.all([this._getRepositoryUrl(), next])
        .spread(function (gitUrl) {
            // Setup the remotes
            return _git.command(_fsPath, "remote", ["add", "origin", _git._addAccessToken(gitUrl)]);
        });
    };

    service._setUserInfo = function(name, email) {
        return _git.config(_fsPath, "user.name", name)
        .then(function() {
            return _git.config(_fsPath, "user.email", email);
        })
        .then(function() {
            // Only push when specified where
            return _git.config(_fsPath, "push.default", "nothing");
        });
    };

    service._branchLineParser = function(line, result) {
        /*
            type of git branch output output this method can parse:

            * (detached from origin/widgets)                    5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles      // Will be ignored
              master                                            dccd034849028653a944d0f82842f802080657bb Update palette and matte
              montagestudio/{username}/master                   dccd034849028653a944d0f82842f802080657bb Update palette and matte      // local shadow branch
              remotes/origin/montagestudio/{username}/master    dccd034849028653a944d0f82842f802080657bb Update palette and matte      // remote shadow branch
              remotes/fork/markdown-editor                      799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor
              remotes/origin/HEAD                               -> origin/master                                                       // Will be ignored
         */

        var parsedLine = line.match(/([ *]+)(\([^)]+\)|[^ ]+)[ ]+([^ ]+)[ ]+(.*)/);
        if (parsedLine.length === 5) {
            var current = (parsedLine[1] === "* ");
            var fullPath = parsedLine[2];
            var sha = parsedLine[3];
            // var commitComment = parsedLine[4];
            var shadowBranch = false;

            if (sha !== "->" && fullPath.charAt(0) !== "(") {   // Skip alias branch (like HEAD) and detached branch
                var _REMOTES_PREFIX = "remotes/",
                    origin,
                    branchName,
                    pos;
                
                if (fullPath.indexOf(_REMOTES_PREFIX) === 0) {
                    // Remote branch
                    fullPath = fullPath.substring(_REMOTES_PREFIX.length);
                    pos = fullPath.indexOf('/');
                    origin = fullPath.substring(0, pos);
                    branchName = fullPath.substring(pos + 1);
                } else {
                    // Local branch
                    origin = LOCAL_SOURCE_NAME;
                    branchName = fullPath;
                }

                // Checking for a shadow branch
                if (branchName.indexOf(SHADOW_BRANCH_PREFIX) === 0) {
                    // if it's not the proper user shadow branch, just ignore it
                    if (branchName.indexOf(USER_SHADOW_BRANCH_PREFIX) === 0) {
                        branchName = branchName.substring(USER_SHADOW_BRANCH_PREFIX.length);
                        shadowBranch = true;
                    } else {
                        return;
                    }
                }

                var repo = result.branches[origin];
                if (!repo) {
                    result.branches[origin] = repo = {};
                }

                var branch = repo[branchName];
                if (!branch) {
                    repo[branchName] = branch = {
                        shadow: null
                    };
                }

                if (shadowBranch) {
                    branch.shadow = {
                        name: fullPath,
                        sha: sha
                    };
                } else {
                    branch.name = fullPath;
                    branch.sha = sha;
                }

                if (current) {
                    result.current = branchName;
                    result.currentIsShadow = shadowBranch;
                }
            }
        }
    };

    service._listBranches = function(forceFetch) {
        return _gitFetch(forceFetch)
        .then(function() {
            return _git.branch(_fsPath, ["-a", "-v", "--no-abbrev"]).then(function(output) {
                var result = {
                    current:null,
                    branches:{}
                };

                output.split(/\r?\n/).forEach(function(line){
                    if (line.length) {
                        service._branchLineParser(line, result);
                    }
                });
                return result;
            });
        });
    };


    service._checkoutShadowBranch = function(branch) {
        var self = this,
            branchesInfo;

        // Validate arguments
        branch = branch || "master";
        if (typeof branch !== "string") {
            return Q.reject(new Error("Invalid checkoutWorkingBranch argument."));
        }

        return self._listBranches()
        .then(function(result) {
            var next;

            branchesInfo = result;

            // Checkout the branch if needed
            if (branchesInfo.current !== branch) {
                if (!branchesInfo.branches[LOCAL_SOURCE_NAME][branch]) {
                    // we do not have a local branch, make sure it exit remotely
                    if (!branchesInfo.branches[REMOTE_SOURCE_NAME][branch]) {
                        throw new Error("Unknown branch " + branch);
                    }
                }
                next = _git.checkout(_fsPath, branch)    // will create the local branch and track the remote one if needed
                .then(function() {
                    return self._listBranches();
                })
                .then(function(result) {
                    branchesInfo = result;
                });
            } else {
                next = Q();
            }
            return next;
        })
        .then(function() {
            // Make sure we have a shadow branch
            return self._createShadowBranch(branchesInfo)
            .then(function(remoteModified) {
                if (remoteModified || !branchesInfo.branches[LOCAL_SOURCE_NAME][branch].shadow) {
                    // we need to refresh the branchesInfo
                    return self._listBranches(remoteModified)
                    .then(function(result) {
                        branchesInfo = result;
                    });
                }
            });
        })
        .then(function() {
            // Checkout the shadow branch if needed
            if (!(branchesInfo.current === branch && branchesInfo.currentIsShadow)) {
                return _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
            }
        });
    };

    service._shadowBranchStatus = function(branch, forceFetch) {
        var self = this,
            shadowBranch,
            result = {
                localParent: {
                    behind: undefined,
                    ahead: undefined
                },

                remoteParent: {
                    behind: undefined,
                    ahead: undefined
                },

                remoteShadow: {
                    behind: undefined,
                    ahead: undefined
                }
            };

        // Validate arguments
        branch = branch || "master";
        if (typeof branch !== "string") {
            return Q.reject(new Error("Invalid shadowBranchStatus argument."));
        }

        shadowBranch = USER_SHADOW_BRANCH_PREFIX + branch;

        return _gitFetch(forceFetch)
        .then(function() {
            return self._branchStatus(shadowBranch, branch);
        })
        .then(function(status) {
            result.localParent = status;
            return self._branchStatus(shadowBranch, REMOTE_SOURCE_NAME + "/" + branch);
        })
        .then(function(status) {
            result.remoteParent = status;
            return self._branchStatus(shadowBranch, REMOTE_SOURCE_NAME + "/" + shadowBranch);
        })
        .then(function(status) {
            result.remoteShadow = status;
            return result;
        });
    };

    service._commitFiles = function(fileUrls, message, remove, amend) {
        var self = this,
            files;

        // Convert fileUrls to relative paths
        if (fileUrls === null && remove !== true) {
            files = ["--all"];
        } else {
            if (!Array.isArray(fileUrls) ) {
                return Q.reject(new Error("Invalid commitFiles argument."));
            }
            files = fileUrls.map(function(url) {
                return _convertProjectUrlToPath(url);
            });
        }

        return (remove === true ? _git.rm(_fsPath, files) : _git.add(_fsPath, files))
        .then(function() {
            // make sure we have staged files before committing
            return self._hasStagedChanges()
            .then(function(hasStagedFile) {
                if (hasStagedFile) {
                    return _git.commit(_fsPath, message || "Update component", amend === true)
                    .then(function() {
                        return _git.currentBranch(_fsPath);
                    }).then(function(current) {
                        if (_gitAutoFlushTimer[current]) {
                            clearTimeout(_gitAutoFlushTimer[current]);
                        }
                        _gitAutoFlushTimer[current] = setTimeout(function() {
                            self.flush(current).done();
                        }, AUTO_FLUSH_TIMEOUT);
                    });
                }
            }).then(function() {
                return {success: true};
            });
        });
    };

    service._commitBatch = function(batch) {
        var self = this,
            files;

        if (batch._addedFiles.length) {
            files = batch._addedFiles.map(function(url) {
                return _convertProjectUrlToPath(url);
            });
            _git.add(_fsPath, files);
        }
        if (batch._removedFiles.length) {
            files = batch._removedFiles.map(function(url) {
                return _convertProjectUrlToPath(url);
            });
            _git.rm(_fsPath, files);
        }

        // make sure we have staged files before committing
        return self._hasStagedChanges()
        .then(function(hasStagedFile) {
            if (hasStagedFile) {
                return _git.commit(_fsPath, batch.message || "Update files")
                .then(function() {
                    return _git.currentBranch(_fsPath);
                }).then(function(current) {
                    if (_gitAutoFlushTimer[current]) {
                        clearTimeout(_gitAutoFlushTimer[current]);
                    }
                    _gitAutoFlushTimer[current] = setTimeout(function() {
                        self.flush(current).done();
                    }, AUTO_FLUSH_TIMEOUT);
                });
            }
        }).then(function() {
            return {success: true};
        });
    };

    /**
     * Will Sync the local shadow branch with the remote shadow and sync the local shadow with the remote parent branch
     *
     * 1. local shadow <-> remote shadow
     *    when local branch is:
     *      ahead: Push to remote
     *      behind: propose rebase
     *      diverged: if rebase possible, propose rebase, else propose conflict resolution
     *
     * 2. local shadow <- remote master
     *    when local branch is:
     *      ahead: do nothing
     *      behind: propose rebase
     *      diverged: if rebase possible, propose rebase, else nothing
     */
    service._updateRefs = function(resolutionStrategy, reference, forceFetch) {
        var self = this,
            returnValue = {
                success: true
            },
            branchesInfo = null,
            current,
            local,
            remote;

        var SHADOW_STEP = 1,
            PARENT_STEP = 2;

        // Validate arguments
        reference = reference || {
            step: 0
        };
        forceFetch = (forceFetch === true);

        // INIT_STEP: update branches and make sure we have shadow branches
        return self._hasUncommittedChanges(true)
        .then(function(hasUncommittedChanges) {
            if (hasUncommittedChanges) {
                return self._recoverChanges();
            }
        })
        .then(function() {
             // Fetch and retrieve the branches and their refs
            return self._listBranches(forceFetch);
        })
        .then(function(result) {
            branchesInfo = result;
            current = branchesInfo.current;
            local = branchesInfo.branches[LOCAL_SOURCE_NAME][current];
            remote = branchesInfo.branches[REMOTE_SOURCE_NAME][current];

            if (!branchesInfo.currentIsShadow || !local.shadow || !remote.shadow) {
                return self._checkoutShadowBranch(current)
                .then(function() {
                    return self._listBranches().then(function(result) {
                        branchesInfo = result;
                        current = branchesInfo.current;
                    });
                });
            }
        })

        // SHADOW_STEP: Sync the local shadow branch with the remote shadow branch
        .then(function() {
            if (returnValue.success && reference.step <= SHADOW_STEP) {
                return self._syncBranches(branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow,
                    branchesInfo.branches[REMOTE_SOURCE_NAME][current].shadow,
                    reference.step === SHADOW_STEP ? resolutionStrategy : null,
                    true)
                .then(function(result) {
                    if (result.success) {
                        // update the local shadow branch SHA
                        branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow.sha =
                            branchesInfo.branches[REMOTE_SOURCE_NAME][current].shadow.sha;
                    } else {
                        returnValue = result;
                        returnValue.reference = {step: SHADOW_STEP};
                    }
                });
            }
        })

        // PARENT_STEP: Sync the local shadow branch with the remote parent branch (one way only)
        .then(function() {
            if (returnValue.success && reference.step <= PARENT_STEP) {
                return self._syncBranches(branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow,
                    branchesInfo.branches[REMOTE_SOURCE_NAME][current],
                    // Inherit previous state stategy resolution only if it's rebase
                    reference.step === PARENT_STEP ? resolutionStrategy : resolutionStrategy === "rebase" ? "rebase" : null)
                .then(function(result) {
                    if (!result.success) {
                        returnValue = result;
                        returnValue.reference = {step: PARENT_STEP};
                    }
                });
            }
        })

        // FINALIZE_STEP: force push shadow and reset local parent
        .then(function() {
            if (returnValue.success) {
                return self._listBranches()
                .then(function(result) {
                    branchesInfo = result;
                    current = branchesInfo.current;
                    local = branchesInfo.branches[LOCAL_SOURCE_NAME][current];
                    remote = branchesInfo.branches[REMOTE_SOURCE_NAME][current];

                    if (local.shadow.sha !== remote.shadow.sha) {
                        return self._push(local.shadow.name, "--force");    // TODO: We should be using --force-with-lease (git 1.8.5)
                    }
                }).then(function() {
                    if (local.sha !== remote.sha) {
                        return _git.checkout(_fsPath, local.name)
                        .then(function() {
                            return _git.command(_fsPath, "reset", ["--hard", remote.sha]);
                        }).finally(function() {
                            return _git.checkout(_fsPath, local.shadow.name);
                        });
                    }
                });
            }
        })
        .then(function() {
            return returnValue;
        });
    };

    service._syncBranches = function(local, remote, resolutionStrategy, autoMerge) {
        var self = this,
            returnValue = {
                success: true,
                local: local.name,
                remote: remote.name
            },
            next;

        if (local.sha !== remote.sha) {
            return self._branchStatus(local.name, remote.name)
            .then(function(status) {
                if (resolutionStrategy === "rebase") {
                    /*
                        Rebase the local branch on the remote branch
                     */
                    return self._rebase(local.name, remote.name)
                    .then(function(success) {
                        if (!success) {
                            // We cannot rebase, let's propose other solutions
                            returnValue.success = false;
                            returnValue.resolutionStrategy = autoMerge === true ? ["discard", "revert", "force"] : ["discard", "revert"];
                            returnValue.ahead = status.ahead;
                            returnValue.behind = status.behind;
                        }
                    });
                } else if (resolutionStrategy === "discard") {
                    /*
                        Discard local changes
                     */
                    return _git.command(_fsPath, "reset", ["--hard", remote.sha]);
                } else if (resolutionStrategy === "revert") {
                    /*
                        Revert remote changes
                     */
                    if (REMOTE_SOURCE_NAME + "/" + local.name === remote.name) {
                        next = self._revertRemoteChanges(local.name, remote.name, status);
                    } else {
                        next = self._revertParentChanges(local.name, remote.name, status);
                    }

                    return next
                    .fail(function(error) {
                        log("Revert remote changes failed:", error.stack);
                        throw new Error("Revert remote changes failed: " + error.message);
                    });
                } else if (resolutionStrategy === "force") {
                    /*
                        Destroy remote changes
                     */
                    if (autoMerge !== true) {
                        throw new Error("Cannot update the remote repository, try to merge instead");
                    }
                    return self._push(local.name, "--force");   // TODO: We should be using --force-with-lease (git 1.8.5)
                } else {
                    // Default
                    if (status.behind === 0) {
                        // The local branch is ahead of the remote branch, let's just push it
                        if (autoMerge === true) {
                            return self._push(local.name);
                        }
                    } else {
                        returnValue.success = false;
                        returnValue.ahead = status.ahead;
                        returnValue.behind = status.behind;

                        if (status.ahead === 0) {
                            // We can safely rebase
                            returnValue.resolutionStrategy = ["rebase"];
                        } else {
                            // We can try to rebase, discard local changes, revert remote changes or force local changes
                            // Let's do a dry rebase to check if we can safely rebase
                            returnValue.resolutionStrategy = [];
                            return self._rebase(local.name, remote.name, local.sha)
                            .then(function(success) {
                                returnValue.resolutionStrategy = autoMerge === true ? ["discard", "revert", "force"] : ["discard", "revert"];
                                if (success) {
                                    returnValue.resolutionStrategy.unshift("rebase");
                                }
                            });
                        }
                    }
                }
            })
            .then(function() {
                return returnValue;
            });
        } else {
            return Q.resolve(returnValue);
        }
    };

    service._mergeShadowBranch = function(branch, message, squash) {
        var self = this,
            branchesInfo;

        squash = squash === true ? true: false; // Sanitize value, git.merge is very picky about it

        return self._listBranches(true)
        .then(function(result) {
            branchesInfo = result;
            // Make sure we have a shadow branch
            if (!branchesInfo.branches[LOCAL_SOURCE_NAME][branch] || !branchesInfo.branches[LOCAL_SOURCE_NAME][branch].shadow) {
                throw new Error("Invalid branch");
            }
        })
        .then(function() {
            // Make sure we have something to merge...
            return self._branchStatus(branch, USER_SHADOW_BRANCH_PREFIX + branch)
            .then(function(status) {
                _gitFetchLastTimeStamp = 0;

                if (status.behind > 0) {
                    return _git.checkout(_fsPath, branch)
                    .then(function() {
                        // git merge <shadow branch> [--squash]
                        return _git.merge(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch, squash)
                        .catch(function(error) {
                            return _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_SOURCE_NAME][branch].sha])
                            .thenReject(error);
                        });
                    })
                    .then(function() {
                        // git commit -m <message>
                        if (squash) {
                            return _git.commit(_fsPath, message || "merge changes");
                        }
                    })
                    .then(function(){
                        return self._push(branch)
                        .catch(function(error) {
                            return _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_SOURCE_NAME][branch].sha])
                            .thenReject(error);
                        });
                    })
                    .then(function() {
                        // git checkout <shadow branch>
                        return _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
                    })
                    .then(function() {
                        // reset the shadow branch after a squash
                        if (squash) {
                            return _git.command(_fsPath, "reset", ["--hard", branch])
                            .then(function() {
                                return self._push(USER_SHADOW_BRANCH_PREFIX + branch, "--force");
                            });
                        }
                    }).then(function() {
                        return true;
                    }, function(error) {
                        // checkout the shadow branch, just in case we are still on the parent branch
                        _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
                        throw error;
                    });
                } else {
                    return true;
                }
            });
        });
    };

    service._flush = function(branch) {
        var self = this;

        return _git.currentBranch(_fsPath)
        .then(function(current) {
            branch = branch || current;
            return self._push(branch);
        }).then(function() {
            return {success: true};
        }, function() {
            // An error occurs when pushing, let's see if we can just rebase it
            return self._flushRebase(branch);
        })
        .then(function(result) {
            Frontend.dispatchEventNamed("repositoryFlushed", true, true, result).done();
            return result;
        })
        .finally(function() {
            if (_gitAutoFlushTimer[branch]) {
                clearTimeout(_gitAutoFlushTimer[branch]);
                _gitAutoFlushTimer[branch] = null;
            }
        });
    };

    service._flushRebase = function(branch) {
        var self = this;

        return _gitFetch(true)
        .then(function(){
            return self._rebase(branch, REMOTE_SOURCE_NAME + "/" + branch);
        })
        .then(function(success) {
            if (success) {
                // Rebase was successful, let push it
                return self._push(branch)
                .then(function() {
                    return {success: true};
                }, function() {
                    return {success: false};
                });
            } else {
                return {success: false};
            }
        });
    };

    service._branchStatus = function(localBranch, remoteBranch) {
        return Q.spread([
            _git.command(_fsPath, "rev-list", ["--first-parent", localBranch + ".." + remoteBranch, "--count"], true),
            _git.command(_fsPath, "rev-list", ["--first-parent", remoteBranch + ".." + localBranch, "--count"], true)
        ], function(behind, ahead) {
            return {
                behind: parseInt(behind, 10),
                ahead: parseInt(ahead, 10)
            };
        });
    };

    service._status = function() {
        return _git.status(_fsPath, ["--porcelain"])
        .then(function(output) {
            var result = [];

            output.split(/\r?\n/).forEach(function(line){
                if (line.length) {
                    var parsedLine = line.match(/([ MADRCU?!])([ MADRCU?!]) (.*)/);
                    if (parsedLine.length === 4 && parsedLine[0] === line) {
                        result.push({
                            path: parsedLine[3],
                            src: parsedLine[1] === " " ? "" : parsedLine[1],
                            dest: parsedLine[2] === " " ? "" : parsedLine[2]
                        });
                    }
                }
            });
            return result;
        });
    };

    /*
        _status returns a source and destination flag for all files that are either new, modified, removed, staged,
        untracked or to be ignored.
        To determine is a file need to be committed (whatever it has been already staged or not), we need make sure
        the dest status is not '!' (to be ignored), untracked (new file not yet staged) file will have a dest set to '?'
        ('?' means untracked and '!' means ignore).
     */
    service._hasUncommittedChanges = function(checkForUntrackedFile) {
        return this._status()
        .then(function(result) {
            var uncommittedChanges = false;
            result.some(function(item) {
                if (item.dest !== "!" && (item.dest !== "?" || checkForUntrackedFile === true)) {
                    uncommittedChanges = true;
                    return true;
                }
            });
            return uncommittedChanges;
        });
    };

    /*
        _status returns a source and destination flag for all files that are either new, modified, removed, staged,
        untracked or to be ignored.
        To determine if a file has been staged, you need to make sure it has a src status and its value is neither '?'
        nor '!' ('?' means untracked and '!' means ignore).
     */
    service._hasStagedChanges = function() {
        return this._status()
        .then(function(result) {
            var hasStagedFile = false;
            result.some(function(item) {
                if (item.src.length === 1 && item.src !== "!" && item.src !== "?") {
                    hasStagedFile = true;
                    return true;
                }
            });
            return hasStagedFile;
        });
    };

    service._hasConflicts = function() {
        return this._status()
        .then(function(result) {
            var hasConflicts = false;
            result.some(function(item) {
                if (item.src === "U" && item.dest === "U") {
                    hasConflicts = true;
                    return true;
                }
            });
            return hasConflicts;
        });
    };

    /*
        _createShadowBranch will create the shadow branch either from scratch, or from a remote shadow branch or from an
        old naming convention shadow branch (for backward compatibility)
     */
    service._createShadowBranch = function(branchesInfo) {
        var self = this,
            OLD_USER_SHADOW_BRANCH_PREFIX = OLD_SHADOW_BRANCH_PREFIX + _owner + OLD_SHADOW_BRANCH_SUFFIX,
            next;

        if (branchesInfo) {
            next = Q();
        } else {
            next = this._listBranches(true)
            .then(function(result) {
                branchesInfo = result;
            });
        }
        return next
        .then(function() {
            var currentBranch = branchesInfo.current;

            // if the current branch is the old shadow branch, let's correct the intended branch name
            if (currentBranch.indexOf(OLD_USER_SHADOW_BRANCH_PREFIX) === 0) {
                branchesInfo.current = currentBranch.substring(OLD_USER_SHADOW_BRANCH_PREFIX.length);
            }
        })
        .then(function() {
            var currentBranch = branchesInfo.current,
                local = branchesInfo.branches[LOCAL_SOURCE_NAME] ?
                    branchesInfo.branches[LOCAL_SOURCE_NAME][currentBranch] : null,
                remote = branchesInfo.branches[REMOTE_SOURCE_NAME] ?
                    branchesInfo.branches[REMOTE_SOURCE_NAME][currentBranch] : null,
                next,
                remoteModified = false;

            if (!local || !remote) {
                throw new Error("Missing local or remote " + currentBranch + " branch");
            }

            if (local.shadow) {
                if (!remote.shadow) {
                    // Remote shadow branch missing, let's push it
                    next = self._push(USER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
                } else {
                    next = Q();
                }
            } else if (remote.shadow) {
                // Create a local branch that track the remote shadow branch
                next = _git.branch(_fsPath, ["--track", USER_SHADOW_BRANCH_PREFIX + currentBranch, remote.shadow.name]);
            } else {
                // We do not have a local or remote shadow branch yet. But before creating a new branch,
                // let's check if we have a branch that uses the old shadow branch naming convention and recycle it

                var oldShadowBranchName = OLD_SHADOW_BRANCH_PREFIX + _owner + OLD_SHADOW_BRANCH_SUFFIX + currentBranch,
                    oldLocalShadow = branchesInfo.branches[LOCAL_SOURCE_NAME] ?
                        branchesInfo.branches[LOCAL_SOURCE_NAME][oldShadowBranchName] : null,
                    oldRemoteShadow = branchesInfo.branches[REMOTE_SOURCE_NAME] ?
                        branchesInfo.branches[REMOTE_SOURCE_NAME][oldShadowBranchName] : null;

                next = Q().then(function() {
                    // <!-- backward compatibility code, can be removed in the future...
                    if (oldRemoteShadow) {
                        var statusPromise;

                        if (!oldLocalShadow || (oldLocalShadow.sha === oldRemoteShadow.sha)) {
                            statusPromise = Q.resolve({behind:0, ahead:0});
                        } else {
                            statusPromise = self._branchStatus(oldLocalShadow.name, oldRemoteShadow.name);
                        }

                        return statusPromise
                        .then(function(status) {
                            if (status.behind === 0) {
                                // We can safely delete the old remote shadow branch
                                return self._push(":" + oldShadowBranchName).then(function() {
                                    oldRemoteShadow = null;
                                });
                            }
                        });
                    }
                    // ...backward compatibility code, can be removed in the future -->
                }).then(function() {
                    // <!-- backward compatibility code, can be removed in the future...
                    if (oldRemoteShadow && !oldLocalShadow) {
                        // checkout the old remote using the new shadow name
                        return _git.command(_fsPath, "checkout", [oldRemoteShadow.name, "-b", USER_SHADOW_BRANCH_PREFIX + currentBranch]);
                    } else if (oldLocalShadow) {
                        // Rename local branch
                        return _git.command(_fsPath, "branch", ["-m", oldShadowBranchName, USER_SHADOW_BRANCH_PREFIX + currentBranch]);
                    } else
                    // ...backward compatibility code, can be removed in the future -->
                    {
                        // create a new shadow branch locally
                        return _git.branch(_fsPath, ["--no-track", USER_SHADOW_BRANCH_PREFIX + currentBranch, remote.name]);
                    }
                }).then(function() {
                    // Push the shadow branch to the remote and track it
                    remoteModified = true;
                    return self._push(USER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
                });
            }

            return next
            .then(function() {
                return remoteModified;
            });
        });
    };

    service._revertRemoteChanges = function(local, remote, status) {
        var self = this,
            stashed = false,
            branchesInfo,
            next;

        return this._listBranches()
        .then(function(result) {
            branchesInfo = result;
        })
        .then(function() {
            return self._hasUncommittedChanges()
            .then(function(uncommittedChanges) {
                if (uncommittedChanges) {
                    return _git.command(_fsPath, "stash", ["save", "local changes"])
                    .then(function() {
                        stashed = true;
                    });
                }
            });
        })
        .then(function() {
            if (! status) {
                return self._branchStatus(local, remote)
                .then(function(result) {
                    status = result;
                });
            }
        })
        .then(function() {
            if (status.behind > 0) {
                // Before we can revert, we need to move away our local commits
                if (status.ahead > 0) {
                    next = _git.command(_fsPath, "reset", ["--soft", "HEAD~" + status.ahead])
                    .then(function() {
                        return _git.command(_fsPath, "stash", ["save", "local commits"]);
                    }).then(function() {
                        return self._rebase(local, remote);
                    });
                } else {
                    next = Q();
                }

                // Let's revert the remote changes
                return next
                .then(function() {
                    return _git.command(_fsPath, "revert", ["HEAD~" + status.behind + "..HEAD"]);
                })
                .then(function() {
                    if (status.ahead > 0) {
                        return _git.command(_fsPath, "stash", ["pop"])
                        .then(function() {
                            return _git.command(_fsPath, "commit", ["-a", "-m", "replay local commits"]);
                        });
                    }
                })
                .then(function() {
                    // push the parent
                    return self._push(local);
                });
            }
        })
        .then(function() {
            if (stashed) {
                return _git.command(_fsPath, "stash", ["pop"]);
            }
        });
    };

    service._revertParentChanges = function(local, remote, status) {
        var self = this,
            parentBranch,
            shadowBranch,
            branchesInfo;

        return this._listBranches()
        .then(function(result) {
            var index = remote.indexOf("/");

            branchesInfo = result;
            shadowBranch = local;
            parentBranch = remote.substring(index + 1);
        })
        .then(function() {
            if (! status) {
                return self._branchStatus(local, remote)
                .then(function(result) {
                    status = result;
                });
            }
        })
        .then(function() {
            // checkout the parent branch
            return _git.checkout(_fsPath, parentBranch);
        })
        .then(function() {
            // reset the local parent branch to match the remote parent
            return _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[REMOTE_SOURCE_NAME][parentBranch].sha]);
        })
        .then(function() {
            // revert parent changes
            return _git.command(_fsPath, "revert", ["HEAD~" + status.behind + "..HEAD"]);
        })
        .then(function() {
            // push the parent
            return self._push(parentBranch);
        })
        .then(function() {
            // force fecth in order to rbe able to properly rebase
            return _gitFetch(true);
        })
        .then(function() {
            // Get back on the shadow branch
            return _git.checkout(_fsPath, shadowBranch);
        })
        .then(function() {
            // now, we can safely rebase the shadow on the parent
            return self._rebase(shadowBranch, remote);
        })
        .finally(function() {
            // In case something went wrong earlier, make sure we go back to the shadow branch
            return _git.checkout(_fsPath, shadowBranch);
        });
    };

    service._push = function(local, options) {
        return this._getRepositoryUrl()
        .then(function(repoUrl) {
            return _git.push(_fsPath, repoUrl, local, options)
            .then(function() {
                _gitFetchLastTimeStamp = 0;
            });
        });
    };

    service._rebase = function(local, remote, dryRunSha) {
        var options = [remote, local];

        return _git.command(_fsPath, "rebase", options)
        .then(function() {
            if (dryRunSha) {
                return _git.command(_fsPath, "reset", ["--hard", dryRunSha])
                .thenResolve(true);
            }
            return true;
        })
        .catch(function() {
            return _git.command(_fsPath, "rebase", "--abort")
            .then(function() {
                return false;
            },
            function() {
                return false;
            });
        });
    };

    service._reset = function (ref) {
        var self = this,
            currentBranchName;

        return self._listBranches(true)     // Will cause to do a git fetch
            .then(function(result) {
                currentBranchName = result.current;
                if (result.currentIsShadow) {
                    currentBranchName = self.USER_SHADOW_BRANCH_PREFIX + currentBranchName;
                }
                return result;
            })
            .then(function () {
                _git.command(_fsPath, "reset", ["--hard", ref ? ref : "HEAD"]);
            })
            .then(function () {
                return self._push(currentBranchName, "--force");
            })
            .then(function() {
                return true;
            }, function(error) {
                log("push failed", error.stack);
                return false;
            });
    };

    service._setupRepoWatch = function() {
        var self = this;

        if (_githubPollTimer === null) {
            var eTag = 0,
               pollInterval = 0;

            var _pollGithub = function() {
                _githubApi.getRepositoryEvents(_owner, _repo, eTag).then(function(response) {
                    var prevEtag = eTag;

                    eTag = response.etag;
                    pollInterval = response['x-poll-interval']; // we should respect the poll interval provided by github
                    if (prevEtag !== 0) {
                        /* We could check the response for any push events done after our last push but the easy way
                           is just to retrieves the branches info and check their refs
                         */
                        self.listBranches(true).then(function(info) {
                            var currentBranch = info.current,
                                branches = info.branches,
                                localBranch = branches[LOCAL_SOURCE_NAME][currentBranch],
                                remoteBranch = branches[REMOTE_SOURCE_NAME][currentBranch];

                            if (remoteBranch && ((localBranch.sha !== remoteBranch.sha)) ||
                                    (remoteBranch.shadow && (localBranch.shadow.sha !== remoteBranch.shadow.sha))) {
                                var detail = {};
                                detail.localRef = localBranch.sha;
                                detail.localShadowRef = localBranch.shadow ? localBranch.shadow.sha : undefined;
                                if (remoteBranch) {
                                    detail.remoteRef = remoteBranch.sha;
                                    detail.remoteShadowRef = remoteBranch.shadow ? remoteBranch.shadow.sha : undefined;
                                }
                                Frontend.dispatchEventNamed("remoteChange", true, true, detail).done();
                            }
                        });
                    }
                })
                .finally(function() {
                    pollInterval = pollInterval || 60;  // In case of failure before we had time to get the poll interval, just set it to 60 secs
                    _githubPollTimer = setTimeout(_pollGithub, pollInterval * 1000);
                });
            };

            _pollGithub();
        }
    };

    service._recoverChanges = function() {
        var self = this,
            batch = this.openCommitBatch("auto-recovery"),
            hasChanges = false;

        return self._status()
        .then(function(result) {
            result.forEach(function(item) {
                // Files marked as '!' are to be ignored
                if (item.src !== '!' && item.dest !== '!') {
                    hasChanges = true;
                    if (item.dest === "D") {
                        batch.stageFilesForDeletion(item.path);
                    } else {
                        batch.stageFiles(item.path);
                    }
                }
            });
            return hasChanges;
        })
        .then(function(hasChanges) {
            if (hasChanges) {
                batch.commit();
            } else {
                batch.release();
            }
        });
    };

    service.close = function() {
        delete _cachedServices[serviceUUID];
        if (_githubPollTimer) {
            clearTimeout(_githubPollTimer);
            _githubPollTimer = null;
        }
    };

    Object.defineProperties(service, {
        LOCAL_SOURCE_NAME: {
            get: function() {
                return LOCAL_SOURCE_NAME;
            }
        },

        REMOTE_SOURCE_NAME: {
            get: function() {
                return REMOTE_SOURCE_NAME;
            }
        },

        USER_SHADOW_BRANCH_PREFIX: {
            get: function() {
                return USER_SHADOW_BRANCH_PREFIX;
            }
        }
    });

    // Install github watch
    service._setupRepoWatch();

    return service;
}
