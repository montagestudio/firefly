var Q = require("q");
var Git = require("../git");
var GithubApi = require("../../inject/adaptor/client/core/github-api");
var log = require("../../logging").from(__filename);

module.exports = exports = RepositoryService;   // High level access to the service
module.exports.service = _RepositoryService;    // Low level access to the service

var LOCAL_REPOSITORY_NAME = "__local__";
var REMOTE_REPOSITORY_NAME = "origin";
var SHADOW_BRANCH_PREFIX = "__mb__";
var SHADOW_BRANCH_SUFFIX = "__";
var OWNER_SHADOW_BRANCH_PREFIX;

var semaphore = Git.semaphore;

function RepositoryService(session, fs, environment, pathname, fsPath) {
    return _RepositoryService(session.owner, session.githubAccessToken, session.repo, fs, fsPath, true);
}

function _RepositoryService(owner, githubAccessToken, repo, fs, fsPath, acceptOnlyHttpsRemote) {
    // Returned service
    var service = {},
        _owner = owner,
        _repo = repo,
        _accessToken = githubAccessToken,
        _git = new Git(fs, _accessToken, acceptOnlyHttpsRemote),
        _githubApi = new GithubApi(_accessToken),
        _info = null,
        checkGithubError;

    OWNER_SHADOW_BRANCH_PREFIX = SHADOW_BRANCH_PREFIX + _owner + SHADOW_BRANCH_SUFFIX;

    checkGithubError = function(method) {
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
    service.setupProject = checkGithubError(semaphore.exclusive(function() {
        return this._setupProject();
    }));

    /**
     * setup a project by cloning it from github
     */
    service.cloneProject = checkGithubError(semaphore.exclusive(function() {
        return this._cloneProject();
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
     * Return an object describing all branches (local and remotes) as well the current
     * branch (checked out). If a shadow branch is checked out, current will represent
     * the name of the parent branch and the property currentIsShadow is set to true.
     *
     * Shadow branches are represented as an attribute of their parent branch and are
     * not listed on their own
     *
     * argument: none
     *
     * return: promise for an branches object
     *
     * branches object format:
     * {
     *      current: <branch name>,
     *      currentIsShadow: <boolean>,
     *      branches: {
     *          <LOCAL_REPOSITORY_NAME>: [
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
     *          <REMOTE_REPOSITORY_NAME>: [
     *              ...
     *          ],
     *          ...
     *      }
     * }
     */
    service.listBranches = checkGithubError(semaphore.exclusive(function() {
        return this._listBranches(true);
    }));

    /**
     * Checkout the shadowbranch for the branch branch.
     *
     * If the shadow branch does not exist locally and / or remotely
     * the shadow branches are created.
     *
     * The parent branch does not have to exist localy but must be remotely.
     *
     * Call this method before using commitFiles or updateRefs.
     *
     * argument:
     *      branch: branch name to checkout (without shadow branch prefix)
     *
     * return: promise
     */
    service.checkoutShadowBranch = checkGithubError(semaphore.exclusive(function(branch) {
        return this._checkoutShadowBranch(branch);
    }));

    /**
     * Return the status of the local shadow branch compared to the local
     * parent branch and the remote parent branch.
     *
     * argument:
     *      branch: branch name to checkout (without shadow branch prefix)
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
    service.shadowBranchStatus = checkGithubError(semaphore.exclusive(function(branch) {
        return this._shadowBranchStatus(branch);
    }));

    /**
     * Commit files to the current branch and push the commit to the
     * remote repository. Make sure to call checkoutShadowBranch before.
     *
     * if a conflict occurs during the push of the commit, the returned object
     * will have a list of resolution strategies to resolve the conflict.
     * Call commitFiles again with an resolution strategy to resolve the conflict.
     *
     * Note: commitFiles will automatically rebase the local shadow branch if possible.
     *
     * Possible resolutionStrategy are:
     *  - "discard": Discard the local commit and update the local repository
     *               with the remote changes
     *  - "revert":  Revert the remote commits and push the local changes
     *
     * argument:
     *                   files: Array of file paths relative to the project, can pass ["."] to
     *                          commit all files
     *                 message: [optional] text to use for the commit's message
     *      resolutionStrategy: [optional] resolution strategy to use to resolve conflicts
     *
     * return: promise
     */
    service.commitFiles = checkGithubError(semaphore.exclusive(function(files, message, resolutionStrategy) {
        return this._commitFiles(files || "--all", message, resolutionStrategy);
    }));

    /**
     * Update References. Will keep in syncs the current branch as well its shadow branch.
     * If a conflict occurs, a resolution strategy can be provided.
     *
     * Make sure to call checkoutShadowBranch before and make sure there is not uncommitted
     * changes.
     *
     * updateRefs returns notifications and possible resolution strategies in case of a conflict
     * or if the local branch need to be updated.
     *
     * Possible resolution strategy are:
     *  - "rebase":  Update the local repository by rebasing (could failed, check returned
     *               resolution strategies for alternatives.
     *  - "discard": Discard the local commit and update the local repository
     *               with the remote changes
     *  - "revert":  Revert the remote commits and push the local changes
     *
     * argument:
     *      resolutionStrategy:  [optional] resolution strategy to use to resolve conflict
     *
     * return: promise for an notifications object
     */
    service.updateRefs = checkGithubError(semaphore.exclusive(function(resolutionStrategy) {
        return this._updateRefs(resolutionStrategy);
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
    service.mergeShadowBranch = checkGithubError(semaphore.exclusive(function(branch, message, squash) {
        return this._mergeShadowBranch(branch, message, squash);
    }));

    service._getInfo = function() {
        if (!_info) {
            var deferred = Q.defer();
            _info = deferred.promise;

            _githubApi.getInfo(_owner, _repo)
            .then(deferred.resolve, deferred.reject).done();
        }

        return _info;
    };

    service._getRepositoryUrl = function() {
        return service._getInfo().then(function(info) {
            return _git._addAccessToken(info.gitUrl);
        });
    };

    service._setupProject = function() {
        var self = this;

        return _git.init(fsPath)
        .then(function() {
            return self._getInfo();
        }).then(function(info) {
            return _git.addRemote(fsPath, info.gitUrl);
        });
    };

    service._cloneProject = function() {
        return this._getInfo()
        .then(function(info) {
            return _git.clone(info.gitUrl, fsPath);
        });
    };

    service._setUserInfo = function(name, email) {
        return _git.config(fsPath, "user.name", name)
        .then(function() {
            return _git.config(fsPath, "user.email", email);
        })
        .then(function() {
            // Only push when specified where
            return _git.config(fsPath, "push.default", "nothing");
        });
    };

    service._branchLineParser = function(line, result) {
        /*
            type of git branch output output this method can parse:

            * (detached from origin/widgets)         5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles      // Will be ignored
              master                                 dccd034849028653a944d0f82842f802080657bb Update palette and matte
              __mb__master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte      // shadow branch
              remotes/fork/markdown-editor           799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor
              remotes/origin/HEAD                    -> origin/master                                                       // Will be ignored
         */

        var parsedLine = line.match(/([ *]+)(\([^)]+\)|[^ ]+)[ ]+([^ ]+)[ ]+(.*)/);
        if (parsedLine.length === 5) {
            var current = (parsedLine[1] === "* ");
            var fullPath = parsedLine[2];
            var sha = parsedLine[3];
            // var commitComment = parsedLine[4];
            var shadowBranch = false;

            if (sha !== "->" && fullPath.charAt(0) !== "(") {   // Skip alias branch (like HEAD) and detached branch
                // Split the fullPath into path and name
                var firstPos = fullPath.indexOf('/');
                var lastPos = fullPath.lastIndexOf('/');
                var branchName;
                var repoName;

                if (lastPos !== -1) {
                    branchName = fullPath.substring(lastPos + 1);
                    repoName = fullPath.substring(firstPos + 1, lastPos);
                    fullPath = fullPath.substring(firstPos + 1);
                } else {
                    branchName = fullPath;
                    repoName = LOCAL_REPOSITORY_NAME;
                }

                // Checking for a shadow branch
                if (branchName.indexOf(SHADOW_BRANCH_PREFIX) === 0) {
                    // if it's not the proper user shadow branch, just ignore it
                    if (branchName.indexOf(OWNER_SHADOW_BRANCH_PREFIX) === 0) {
                        branchName = branchName.substring(OWNER_SHADOW_BRANCH_PREFIX.length);
                        shadowBranch = true;
                    } else {
                        return;
                    }
                }

                var repo = result.branches[repoName];
                if (!repo) {
                    result.branches[repoName] = repo = {};
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

    service._listBranches = function(fetch) {
        var next;

        if (fetch === false) {
            next = Q();
        } else {
            next = _git.fetch(fsPath, this.REMOTE_REPOSITORY_NAME, ["--prune"]);
        }

        return next
        .then(function() {
            return _git.branch(fsPath, ["-a", "-v", "--no-abbrev"]).then(function(output) {
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

        return self._listBranches(true)
        .then(function(result) {
            var next;

            branchesInfo = result;

            // Checkout the branch if needed
            if (branchesInfo.current !== branch) {
                if (!branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch]) {
                    // we do not have a local branch, make sure it exit remotely
                    if (!branchesInfo.branches[REMOTE_REPOSITORY_NAME][branch]) {
                        throw new Error("Unknown branch " + branch);
                    }
                }
                next = _git.checkout(fsPath, branch)    // will create the local branch and track the remote one if needed
                .then(function() {
                    return self._listBranches(false);
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
                if (remoteModified || !branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch].shadow) {
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
                return _git.checkout(fsPath, OWNER_SHADOW_BRANCH_PREFIX + branch);
            }
        });
    };

    service._shadowBranchStatus = function(branch) {
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

        shadowBranch = OWNER_SHADOW_BRANCH_PREFIX + branch;

        return _git.fetch(fsPath, this.REMOTE_REPOSITORY_NAME, ["--prune"])
        .then(function() {
            return self._branchStatus(shadowBranch, branch);
        })
        .then(function(status) {
            result.localParent = status;
            return self._branchStatus(shadowBranch, REMOTE_REPOSITORY_NAME + "/" + branch);
        })
        .then(function(status) {
            result.remoteParent = status;
            return self._branchStatus(shadowBranch, REMOTE_REPOSITORY_NAME + "/" + shadowBranch);
        })
        .then(function(status) {
            result.remoteShadow = status;
            return result;
        });
    };

    service._commitFiles = function(files, message, resolutionStrategy) {
        var self = this,
            branchesInfo = null,
            current,
            emptyRepository = false;

        // Validate arguments
        if (typeof files === "string" && files.length !== 0) {
            files = [files];
        }
        if (!Array.isArray(files)) {
            return Q.reject(new Error("Invalid saveFiles argument."));
        }

        return self._listBranches(true)     // Will cause to do a git fetch
        .then(function(result) {
            branchesInfo = result;
            current = branchesInfo.current || "master";
            if (branchesInfo.currentIsShadow) {
                current = OWNER_SHADOW_BRANCH_PREFIX + current;
            }
            emptyRepository = (Object.keys(branchesInfo.branches).length === 0);
        })
        .then(function() {
            // stage the files
            return _git.add(fsPath, files);
        })
        .then(function() {
            // make sure we have staged files before committing
            return self._hasUncommittedChanges()
            .then(function(hasUncommittedChanges) {
                if (hasUncommittedChanges) {
                    return _git.commit(fsPath, message || "Update component");
                }
            });
        })
        .then(function() {
            // push the commits if we have some
            if (emptyRepository) {
                return self._push(current)
                .then(function() {
                    return true;
                }, function(error) {
                    log("push failed", error.stack);
                    return false;
                });
            }

            return self._branchStatus(current, REMOTE_REPOSITORY_NAME + "/" + current)
            .then(function(branchStatus) {
                if (branchStatus.ahead > 0 ) {
                    return self._push(current)
                    .then(function() {
                        return true;
                    }, function(error) {
                        log("push failed", error.stack);
                        return false;
                    });
                } else {
                    return true;
                }
            });
        })
        .then(function(pushSuccessfulOrNothingDone) {
            if (pushSuccessfulOrNothingDone) {
                return {
                    success: true
                };
            } else {
                if (resolutionStrategy === "discard") {
                    /*
                        Resolve conflict by discarding local changes
                     */
                    var branch = branchesInfo.branches[REMOTE_REPOSITORY_NAME][branchesInfo.current],
                        sha;

                    if (branch) {
                        if (branchesInfo.currentIsShadow) {
                            if (branch.shadow) {
                                sha = branch.shadow.sha;
                            }
                        } else {
                            sha = branch.sha;
                        }
                    }
                    if (!sha) {
                        throw new Error("Cannot discard local changes, invalid SHA");
                    }
                    return _git.command(fsPath, "reset", ["--hard", sha])
                    .thenResolve({success: true});
                } else if (resolutionStrategy === "revert") {
                    /*
                        Resolve conflict by reverting remote changes
                     */
                    return self._revertRemoteChanges(current, branchesInfo)
                    .then(function() {
                        return {
                            success: true
                        };
                    }, function(error) {
                        log("Revert remote changes failed:", error.stack);
                        throw new Error("Revert remote changes failed: " + error.message);
                    });
                } else {
                    // By default, let's try to rebase it
                    return self._rebase(current, REMOTE_REPOSITORY_NAME + "/" + current).then(function(success) {
                        if (success) {
                            // Rebase was successfull, let push it again
                            return self._push(current)
                            .then(function() {
                                return {
                                    success: true
                                };
                            }, function(error) {
                                log("Push after rebase failed:", error.stack);
                                throw new Error("Push after rebase failed: " + error.message);
                            });
                        } else {
                            // Rebase failed
                            return self._branchStatus(current, REMOTE_REPOSITORY_NAME + "/" + current)
                            .then(function(status) {
                                return {
                                    success: false,
                                    ahead: status.ahead,
                                    behind: status.behind,
                                    resolutionStrategy: ["discard", "revert"]
                                };
                            });
                        }
                    });
                }
            }
        });
    };

    service._updateRefs = function(resolutionStrategy) {
        var self = this,
            next,
            returnValue = {
                success: true,
                notifications: []
            },
            branchesInfo = null,
            current;

        // make sure we do not have any local uncommitted changes
        return self._hasUncommittedChanges().then(function(hasUncommittedChanges) {
            if (hasUncommittedChanges) {
                throw new Error("Cannot update refs while there is uncommited changes");
            }

            // Fetch and retrieve the branches and their refs
            return self._listBranches(true)
            .then(function(result) {
                branchesInfo = result;
                current = branchesInfo.current;
            })
            .then(function() {
                // Update the parent branch
                var local = branchesInfo.branches[LOCAL_REPOSITORY_NAME][current],
                    remote = branchesInfo.branches[REMOTE_REPOSITORY_NAME][current];

                if (remote && local.sha !== remote.sha) {
                    return self._branchStatus(local.name, remote.name)
                    .then(function(status) {
                        if (status.ahead > 0) {
                            log("Parent branch has local " + status.ahead + " commit(s)");
                            return _git.checkout(fsPath, current)
                            .then(function() {
                                return _git.command(fsPath, "reset", ["--hard", "HEAD~" + status.ahead]);
                            })
                            .then(function() {
                                returnValue.notifications.push({type:"parentReset", branch:current, ahead:status.ahead});
                                return _git.checkout(fsPath, OWNER_SHADOW_BRANCH_PREFIX + current)
                                .thenResolve(status);
                            }, function(error) {
                                return _git.checkout(fsPath, OWNER_SHADOW_BRANCH_PREFIX + current)
                                .thenReject(error);
                            });
                        } else {
                            return status;
                        }
                    })
                    .then(function(status) {
                        if (status.behind > 0) {
                            returnValue.notifications.push({type:"parentUpdated", branch:current, behind:status.behind});
                            return self._rebase(local.name, remote.name).then(function(success) {
                                if (!success) {
                                    throw new Error("Parent branch rebase failed");
                                }
                            });
                        }
                    });
                } else {
                    return Q();
                }
            })
            .then(function() {
                var didPush = false;

                // check shadow branch
                var local = branchesInfo.branches[LOCAL_REPOSITORY_NAME][current],
                    remote = branchesInfo.branches[REMOTE_REPOSITORY_NAME][current];

                if (local.shadow || remote.shadow) {
                    if (!local.shadow || !remote.shadow) {
                        // create missing shadow branch (local or remote)
                        next = self._createShadowBranch(branchesInfo)
                        .then(function(remoteModified) {
                            return self._listBranches(remoteModified)
                            .then(function(result) {
                                branchesInfo = result;
                                local = branchesInfo.branches[LOCAL_REPOSITORY_NAME][current];
                                remote = branchesInfo.branches[REMOTE_REPOSITORY_NAME][current];
                            });
                        });
                    } else {
                        next = Q();
                    }
                    return next.then(function() {
                        // check if local shadow differs from remote shadow, rebase if possible else bailout
                        if (local.shadow.sha !== remote.shadow.sha) {
                            return self._branchStatus(local.shadow.name, remote.shadow.name)
                            .then(function(status) {
                                if (resolutionStrategy === "rebase") {
                                    /*
                                        Rebase the local branch with the remote branch
                                     */
                                    return self._rebase(local.shadow.name, remote.shadow.name)
                                    .then(function(success) {
                                        if (success) {
                                            didPush = true;
                                            returnValue.success = success;
                                        } else {
                                            // We cannot rebase, let's propose other solutions
                                            returnValue.success = false;
                                            returnValue.resolutionStrategy = ["discard", "revert"];
                                            returnValue.notifications.push({
                                                type: "shadowsOutOfSync",
                                                branch: current,
                                                ahead: status.ahead,
                                                behind: status.behind
                                            });
                                        }
                                        resolutionStrategy = "";
                                    });
                                } else if (resolutionStrategy === "discard") {
                                    /*
                                        Discard local changes
                                    */
                                    return _git.command(fsPath, "reset", ["--hard", remote.shadow.sha])
                                    .then(function() {
                                        returnValue.success = true;
                                        resolutionStrategy = "";
                                    });
                                } else if (resolutionStrategy === "revert") {
                                    /*
                                        Revert remote changes
                                     */
                                    return self._revertRemoteChanges(OWNER_SHADOW_BRANCH_PREFIX + current, branchesInfo, status)
                                    .then(function() {
                                        didPush = true;
                                        returnValue.success = true;
                                        resolutionStrategy = "";
                                    }, function(error) {
                                        log("Revert remote changes failed:", error.stack);
                                        throw new Error("Revert remote changes failed: " + error.message);
                                    });
                                } else {
                                    // Default
                                    if (status.behind === 0) {
                                        // Somehow the local shadow is ahead of the remote shadow, let's just push it
                                        return self._push(local.shadow.name)
                                        .then(function() {
                                            didPush = true;
                                            returnValue.success = true;
                                        });
                                    } else {
                                        returnValue.success = false;
                                        returnValue.notifications.push({
                                            type: "shadowsOutOfSync",
                                            branch: current,
                                            ahead: status.ahead,
                                            behind: status.behind
                                        });
                                        if (status.ahead === 0) {
                                            // We can safely rebase
                                            returnValue.resolutionStrategy = ["rebase"];
                                        } else {
                                            // We can try to rebase, discard local changes or revert remote changes
                                            // Let's do a dry rebase to check if we can safely rebase
                                            returnValue.resolutionStrategy = [];
                                            return self._rebase(local.shadow.name, remote.shadow.name, local.shadow.sha).then(function(success) {
                                                returnValue.resolutionStrategy = ["discard", "revert"];
                                                if (success) {
                                                    returnValue.resolutionStrategy.unshift(["rebase"]);
                                                }
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    })
                    .then(function() {
                        if (didPush) {
                            // We need to update the branches info
                            return self._listBranches(true).then(function(result) {
                                branchesInfo = result;
                                local = branchesInfo.branches[LOCAL_REPOSITORY_NAME][current];
                                remote = branchesInfo.branches[REMOTE_REPOSITORY_NAME][current];
                            });
                        }
                    })
                    .then(function() {
                        // check if shadow differs from parent
                        if (returnValue.success) {
                            if (local.shadow.sha !== remote.sha) {
                                return self._branchStatus(local.shadow.name, remote.name)
                                .then(function(status) {
                                    if (status.behind > 0) {
                                        if (resolutionStrategy === "rebase") {
                                            return self._rebase(local.shadow.name, remote.name)
                                            .then(function(success) {
                                                if (success) {
                                                    didPush = true;
                                                    returnValue.success = success;
                                                } else {
                                                    // We cannot rebase, let's propose other solutions
                                                    returnValue.success = false;
                                                    returnValue.resolutionStrategy = ["discard", "revert"];
                                                    returnValue.notifications.push({
                                                        type: "shadowDivertedFromParent",
                                                        branch: current,
                                                        ahead: status.ahead,
                                                        behind: status.behind
                                                    });
                                                }
                                            });
                                        } else if (resolutionStrategy === "discard") {
                                            /*
                                                Discard local changes
                                            */
                                            return _git.command(fsPath, "reset", ["--hard", remote.sha])
                                            .then(function() {
                                                return self._push(local.shadow.name, "--force");
                                            })
                                            .then(function() {
                                                returnValue.success = true;
                                                resolutionStrategy = "";
                                            });
                                        } else {
                                            // Default
                                            returnValue.success = false;
                                            returnValue.notifications.push({
                                                type: status.ahead > 0 ? "shadowDivertedFromParent" : "shadowBehindParent",
                                                branch: current,
                                                ahead: status.ahead,
                                                behind: status.behind
                                            });
                                            if (status.ahead === 0) {
                                                // We can safely rebase
                                                returnValue.resolutionStrategy = ["rebase"];
                                            } else {
                                                // We can try to rebase, discard local changes or revert remote changes
                                                // Let's do a dry rebase to check if we can safely rebase
                                                returnValue.resolutionStrategy = [];
                                                return self._rebase(local.shadow.name, remote.name, local.shadow.sha).then(function(success) {
                                                    returnValue.resolutionStrategy = ["discard"];
                                                    if (success) {
                                                        returnValue.resolutionStrategy.unshift(["rebase"]);
                                                    }
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            })
            .thenResolve(returnValue);
        });
    };

    service._mergeShadowBranch = function(branch, message, squash) {
        var self = this,
            branchesInfo;

        return self._listBranches(true)
        .then(function(result) {
            branchesInfo = result;
            // Make sure we have a shadow branch
            if (!branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch] || !branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch].shadow) {
                throw new Error("Invalid branch");
            }
        })
        .then(function() {
            // Make sure we have something to merge...
            return self._branchStatus(branch, OWNER_SHADOW_BRANCH_PREFIX + branch)
            .then(function(status) {
                if (status.behind > 0) {
                    return _git.checkout(fsPath, branch)
                    .then(function() {
                        // git merge <shadow branch> [--squash]
                        return _git.merge(fsPath, OWNER_SHADOW_BRANCH_PREFIX + branch, squash)
                        .catch(function(error) {
                            return _git.command(fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch].sha])
                            .thenReject(error);
                        });
                    })
                    .then(function() {
                        // git commit -m <message>
                        if (squash) {
                            return _git.commit(fsPath, message || "merge changes");
                        }
                    })
                    .then(function(){
                        return self._push(branch)
                        .catch(function(error) {
                            return _git.command(fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_REPOSITORY_NAME][branch].sha])
                            .thenReject(error);
                        });
                    })
                    .then(function() {
                        // git checkout <shadow branch>
                        return _git.checkout(fsPath, OWNER_SHADOW_BRANCH_PREFIX + branch);
                    })
                    .then(function() {
                        // reset the shadow branch after a squash
                        if (squash) {
                            return _git.command(fsPath, "reset", ["--hard", branch])
                            .then(function() {
                                return self._push(OWNER_SHADOW_BRANCH_PREFIX + branch, "--force");
                            });
                        }
                    }).then(function() {
                        return true;
                    }, function(error) {
                        // checkout the shadow branch, just in case we are still on the parent branch
                        _git.checkout(fsPath, OWNER_SHADOW_BRANCH_PREFIX + branch);
                        throw error;
                    });
                } else {
                    return true;
                }
            });
        });
    };

    service._branchStatus = function(localBranch, remoteBranch) {
        return Q.spread([
            _git.command(fsPath, "rev-list", ["--first-parent", localBranch + ".." + remoteBranch, "--count"], true),
            _git.command(fsPath, "rev-list", ["--first-parent", remoteBranch + ".." + localBranch, "--count"], true)
        ], function(behind, ahead) {
            return {
                behind: parseInt(behind, 10),
                ahead: parseInt(ahead, 10)
            };
        });
    };

    service._status = function() {
        return _git.status(fsPath, ["--porcelain"])
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

    service._hasUncommittedChanges = function() {
        return this._status()
        .then(function(result) {
            var uncommittedChanges = false;
            result.some(function(item) {
                if (item.dest !== "?" && item.dest !== "!") {
                    uncommittedChanges = true;
                    return true;
                }
            });
            return uncommittedChanges;
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

    service._createShadowBranch = function(branchesInfo) {
        var self = this,
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
            var currentBranch = branchesInfo.current,
                local = branchesInfo.branches[LOCAL_REPOSITORY_NAME][currentBranch],
                remote = branchesInfo.branches[REMOTE_REPOSITORY_NAME][currentBranch],
                next,
                remoteModified = false;

            if (!local || !remote) {
                throw new Error("Missing local or remote " + currentBranch + " branch");
            }

            if (local.shadow) {
                if (!remote.shadow) {
                    // Remote shadow branch missing, let's push it
                    next = self._push(OWNER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
                } else {
                    next = Q();
                }
            } else if (remote.shadow) {
                // Create a local branch that track the remote shadow branch
                next = _git.branch(fsPath, ["--track", OWNER_SHADOW_BRANCH_PREFIX + currentBranch, remote.shadow.name]);
            } else {
                // Create a shadow branch both locally and remotely
                next = _git.branch(fsPath, ["--no-track", OWNER_SHADOW_BRANCH_PREFIX + currentBranch, remote.name])
                .then(function() {
                    remoteModified = true;
                    return self._push(OWNER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
                });
            }

            return next
            .thenResolve(remoteModified);
        });
    };

    service._revertRemoteChanges = function(branch, branchesInfo, status) {
        var self = this,
            stashed = false,
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
            return self._hasUncommittedChanges()
            .then(function(uncommittedChanges) {
                if (uncommittedChanges) {
                    return _git.command(fsPath, "stash", ["save", "local changes"])
                    .then(function() {
                        stashed = true;
                    });
                }
            });
        })
        .then(function() {
            if (!status) {
                return self._branchStatus(branch, REMOTE_REPOSITORY_NAME + "/" + branch);
            } else {
                return status;
            }
        })
        .then(function(status) {
            if (status.behind > 0) {
                // Before we can revert, we need to move away our local commits
                if (status.ahead > 0) {
                    next = _git.command(fsPath, "reset", ["--soft", "HEAD~" + status.ahead])
                    .then(function() {
                        return _git.command(fsPath, "stash", ["save", "local commits"]);
                    }).then(function() {
                        return self._rebase(branch, [REMOTE_REPOSITORY_NAME + "/" + branch]);
                    });
                } else {
                    next = Q();
                }

                // Let's revert the remote changes
                return next
                .then(function() {
                    return _git.command(fsPath, "revert", ["-m 0", "HEAD~" + status.behind + "..HEAD"]);
                })
                .then(function() {
                    if (status.ahead > 0) {
                        return _git.command(fsPath, "stash", ["pop"])
                        .then(function() {
                            return _git.command(fsPath, "commit", ["-a", "-m", "replay local commits"]);
                        });
                    }
                })
                .then(function() {
                    return self._push(branch);
                });
            }
        })
        .then(function() {
            if (stashed) {
                return _git.command(fsPath, "stash", ["pop"]);
            }
        });
    };

    service._push = function(local, options) {
        return this._getRepositoryUrl()
        .then(function(repoUrl) {
            return _git.push(fsPath, repoUrl, local, options);
        });
    };

    service._rebase = function(local, remote, dryRunSha) {
        var options = [remote, local];

        return _git.command(fsPath, "rebase", options)
        .then(function() {
            if (dryRunSha) {
                return _git.command(fsPath, "reset", ["--hard", dryRunSha])
                .thenResolve(true);
            }
            return true;
        })
        .catch(function() {
            return _git.command(fsPath, "rebase", "--abort")
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
                    currentBranchName = self.OWNER_SHADOW_BRANCH_PREFIX + currentBranchName;
                }
                return result;
            })
            .then(function () {
                _git.command(fsPath, "reset", ["--hard", ref]);
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

    Object.defineProperties(service, {
        LOCAL_REPOSITORY_NAME: {
            get: function() {
                return LOCAL_REPOSITORY_NAME;
            }
        },

        REMOTE_REPOSITORY_NAME: {
            get: function() {
                return REMOTE_REPOSITORY_NAME;
            }
        },

        OWNER_SHADOW_BRANCH_PREFIX: {
            get: function() {
                return OWNER_SHADOW_BRANCH_PREFIX;
            }
        }
    });

    return service;
}
