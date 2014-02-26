var Q = require("q");
var Queue = require("q/queue");
var Git = require("../git");
var log = require("logging").from(__filename);

module.exports = exports = RepositoryService;

var LOCAL_REPOSITORY_NAME = "__local__";
var REMOTE_REPOSITORY_NAME = "origin";
var SHADOW_BRANCH_PREFIX = "__mb__";


var semaphore = new Queue();
semaphore.put(); // once for one job at a time

// Wrap any function with exclusive to make sure it want execute before all pending exclusive methods are done
function exclusive(method) {
    return function wrapped() {
        var self = this, args = Array.prototype.slice.call(arguments);
        return semaphore.get()
        .then(function () {
            return method.apply(self, args);
        }).finally(function() {
            semaphore.put();
        });
    };
}

function RepositoryService(session, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {},
        _git = new Git(fs, session.githubAccessToken),
        _repositoryUrl = null;

    service.listBranches = exclusive(function() {
        return this._listBranches(true);
    });

    service.checkoutShadowBranch = exclusive(function(branch) {
        return this._checkoutShadowBranch(branch);
    });

    service.commitFiles = exclusive(function(files, message, conflictResolution) {
        var self = this,
            branchesInfo = null,
            current,
            repositoryUrl;

        // Validate arguments
        if (typeof files === "string" && files.length !== 0) {
            files = [files];
        }
        if (!Array.isArray(files)) {
            return Q.fail("Invalid saveFiles argument.");
        }

        return self._listBranches(true)     // Will cause to do a git fetch
        .then(function(result) {
            branchesInfo = result;
            current = branchesInfo.current;
            if (branchesInfo.currentIsShadow) {
                current = SHADOW_BRANCH_PREFIX + current;
            }
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
            return self._branchStatus(current, REMOTE_REPOSITORY_NAME + "/" + current)
            .then(function(branchtatus) {
                if (branchtatus.ahead > 0 ) {
                    return self._getRepositoryUrl()
                    .then(function(repoUrl) {
                        repositoryUrl = repoUrl;        // Cache the repository url for later use now that we have it
                        return _git.push(fsPath, repositoryUrl, current).then(function() {
                            return true;
                        }, function(error) {
                            log("push failed", error.message);
                            return false;
                        });
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
                if (conflictResolution === "discard") {
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
                    .then(function() {
                        return {
                            success: true
                        };
                    });
                } else if (conflictResolution === "force") {
                    /*
                        Resolve conflict by forcing the local changes
                     */
                    return _git.push(fsPath, repositoryUrl, current, "--force").then(function() {
                        return {
                            success: true
                        };
                    }, function(error) {
                        log("Forced push failed:", error.message);
                        throw new Error("Forced push failed: " + error.message);
                    });
                } else {
                    // By default, let's try to rebase it
                    return _git.command(fsPath, "rebase", [REMOTE_REPOSITORY_NAME + "/" + current, current]).then(function() {
                        // Rebase was successfull, let push it again
                        return _git.push(fsPath, repositoryUrl, current).then(function() {
                            return {
                                success: true
                            };
                        }, function(error) {
                            log("Push after rebase failed:", error.message);
                            throw new Error("Push after rebase failed: " + error.message);
                        });
                    }, function() {
                        // Rebase failed
                        return _git.command(fsPath, "rebase", ["--abort"])
                        .then(function() {
                            return self._branchStatus(current, REMOTE_REPOSITORY_NAME + "/" + current);
                        })
                        .then(function(status) {
                            return {
                                success: false,
                                ahead: status.ahead,
                                behind: status.behind,
                                conflictResolution: ["discard", "force"]
                            };
                        });
                    });
                }
            }
        });
    });


    service._getRepositoryUrl = function() {
        var self = this;

        if (_repositoryUrl) {
            return Q.resolve(_repositoryUrl);
        } else {
            return _git.command(fsPath, "remote", ["-v"], true)
            .then(function(output) {
                output.split(/\r?\n/).some(function(line){
                    if (line.length) {
                        var parsedLine = line.match(/([^\s]+)[\s]+([^\s]*)[\s]*\(([^)]+)\)/);
                        if (parsedLine.length === 4) {
                            var remote = parsedLine[1],
                                url = parsedLine[2],
                                mode = parsedLine[3];

                            if (remote === self.REMOTE_REPOSITORY_NAME && mode === "push") {
                                _repositoryUrl = url;
                                return true;
                            }
                        }
                    }
                });

                return _repositoryUrl;
            });
        }
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
                    shadowBranch = true;
                    branchName = branchName.substring(SHADOW_BRANCH_PREFIX.length);
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
            return Q.fail("Invalid checkoutWorkingBranch argument.");
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
            return self._createShadowBranch(branchesInfo).then(function(remoteModified) {
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
                return _git.checkout(fsPath, SHADOW_BRANCH_PREFIX + branch);
            }
        });
    };

    service._branchStatus = function(localBranch, remoteBranch) {
        return Q.spread([
            _git.command(fsPath, "rev-list", [localBranch + ".." + remoteBranch, "--count"], true),
            _git.command(fsPath, "rev-list", [remoteBranch + ".." + localBranch, "--count"], true)
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
                    next = self._getRepositoryUrl()
                    .then(function(repoUrl) {
                        remoteModified = true;
                        return _git.push(fsPath, repoUrl, SHADOW_BRANCH_PREFIX + currentBranch, ["-u"]);
                    });
                } else {
                    next = Q();
                }
            } else if (remote.shadow) {
                // Create a local branch that track the remote shadow branch
                next = _git.branch(fsPath, ["--track", SHADOW_BRANCH_PREFIX + currentBranch, remote.shadow.name]);
            } else {
                // Create a shadow branch both locally and remotely
                next = _git.branch(fsPath, ["--no-track", SHADOW_BRANCH_PREFIX + currentBranch, remote.name])
                .then(function() {
                    remoteModified = true;
                    return self._getRepositoryUrl()
                    .then(function(repoUrl) {
                        return _git.push(fsPath, repoUrl, SHADOW_BRANCH_PREFIX + currentBranch, ["-u"]);
                    });
                });
            }

            return next
            .then(function() {
                return remoteModified;
            });
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

        SHADOW_BRANCH_PREFIX: {
            get: function() {
                return SHADOW_BRANCH_PREFIX;
            }
        },

        defaultBranchName: {
            get: function() {
                return "master";    // TODO: retrieve the name of the default branch from git
            }
        }

    });

    return service;
}
