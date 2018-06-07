const Q = require("q");
const URL = require("url");
const Git = require("../git");
const GitCommitBatchFactory = require("../git-commit-batch");
const GithubApi = require("../github-api");
const Frontend = require("../frontend");
const log = require("logging").from(__filename);

module.exports = exports = RepositoryService;   // High level access to the service
module.exports.service = _RepositoryService;    // Low level access to the service

// Constants to differentiate between local and remote sources, by default the remote source is 'origin' 
const LOCAL_SOURCE_NAME = "__local__";
const REMOTE_SOURCE_NAME = "origin";

const SHADOW_BRANCH_PREFIX = "montagestudio/";
const SHADOW_BRANCH_SUFFIX = "/";

// old shadow branch name constants for backward compatibility
const OLD_SHADOW_BRANCH_PREFIX = "__mb__";
const OLD_SHADOW_BRANCH_SUFFIX = "__";

const _cachedServices = {};
const semaphore = Git.semaphore;

const GIT_FETCH_TIMEOUT = 30 * 1000;  // 30 seconds
const AUTO_FLUSH_TIMEOUT = 5 * 1000;  // 5 seconds

const makeConvertProjectUrlToPath = exports.makeConvertProjectUrlToPath = () => (url) => {
    const path = URL.parse(url).pathname;
    if (path.charAt(0) === "/") {
        return URL.parse(url).pathname.substr(1);   // Remove the leading /
    } else {
        return URL.parse(url).pathname;
    }
};

function RepositoryService(config, fs, pathname, fsPath, _, githubApi) {
    return _RepositoryService(config.username, config.owner, config.githubAccessToken, config.repo, fs, fsPath, true, githubApi);
}

function _RepositoryService(username, owner, githubAccessToken, repo, fs, fsPath, acceptOnlyHttpsRemote, githubApi) {
    // Returned service
    const serviceUUID = username + ":" + owner + ":" + repo + ":" + fsPath;
    if (_cachedServices[serviceUUID]) {
        return _cachedServices[serviceUUID];
    } else {
        _cachedServices[serviceUUID] = {};
    }

    const service = _cachedServices[serviceUUID],
        _username = username,
        _owner = owner,
        _repo = repo,
        _accessToken = githubAccessToken,
        _fs = fs,
        _fsPath = fsPath,
        _convertProjectUrlToPath = makeConvertProjectUrlToPath(),
        _git = new Git(_fs, _accessToken, acceptOnlyHttpsRemote);
    let _githubApi = githubApi || new GithubApi(_accessToken),
        _info = null,
        _githubPollTimer = null,
        _gitFetchLastTimeStamp = 0,
        _gitFetch,
        _gitAutoFlushTimer = [],
        _checkGithubError,
        _gitCommitBatch = GitCommitBatchFactory(service),
        USER_SHADOW_BRANCH_PREFIX;

    USER_SHADOW_BRANCH_PREFIX = SHADOW_BRANCH_PREFIX + _username + SHADOW_BRANCH_SUFFIX;

    _gitFetch = async (force) => {
        if (force === true || (Date.now() - _gitFetchLastTimeStamp) > GIT_FETCH_TIMEOUT) {
            await _git.fetch(_fsPath, service.REMOTE_SOURCE_NAME, ["--prune"]);
            _gitFetchLastTimeStamp = Date.now();
        }
    };

    _checkGithubError = (method) => _githubApi.checkError(method, owner, service);

    Object.assign(service, {
        /**
         * Set a GithuApi object
         *
         * Use this to setup a different GithubApi object than the default one provided by the service
         */
        setGithubApi(githubApi) {
            _githubApi = githubApi;
        },

        /**
         * Return true if the github project does not contain any file
         */
        isProjectEmpty() {
            return _githubApi.isRepositoryEmpty(_owner, _repo);
        },

        /**
         * Configure the git user information
         */
        setUserInfo(name, email) {
            this._setUserInfo(name, email);
        },

        /**
         * Retrieve the github default branch for the current project
         */
        async defaultBranchName() {
            const info = await this._getInfo();
            return info.gitBranch;
        },

        /**
         * Retrieve information for the specified branch
         */
        async getRepositoryInfo(branchName) {
            const info = {
                username: _username,
                owner: _owner,
                repository: _repo
            };
            let url = await this._getRepositoryUrl();
            // Trim the .git suffix
            const suffixPos = url.indexOf(".git");
            if (suffixPos !== -1) {
                url = url.substring(0, suffixPos);
            }
            info.repositoryUrl = url;
            const result = await this._listBranches();
            const branch = result.branches[LOCAL_SOURCE_NAME][branchName];
            info.branch = branch.name;
            info.shadowBranch = branch.shadow.name;
            return info;
        },

        /**
         * Create a new commit batch
         */
        openCommitBatch(message) {
            return new _gitCommitBatch(message);
        },

        _getInfo() {
            if (!_info) {
                _info = _githubApi.getInfo(_owner, _repo);
            }
            return _info;
        },

        async _getRepositoryUrl() {
            const info = await this._getInfo();
            return _git._addAccessToken(info.gitUrl);
        },

        async _setupProject() {
            await _git.init(_fsPath);
            const gitUrl = await this._getRepositoryUrl();
            return _git.addRemote(_fsPath, gitUrl);
        },

        async _cloneProject() {
            const gitUrl = await this._getRepositoryUrl()
            return _git.clone(gitUrl, _fsPath);
        },

        async _cloneTemplate(path) {
            let next;
            if (path.lastIndexOf(".git") ===  path.length - ".git".length) {
                const _localGit = new Git(_fs, _accessToken, false);  // Use _localGit only for cloning the template
                next = _localGit.clone(path, _fsPath);
            } else {
                log("copy tree");
                next =_fs.copyTree(path, _fsPath);
            }
            const [gitUrl] = await Promise.all([this._getRepositoryUrl(), next]);
            // Setup the remotes
            return _git.command(_fsPath, "remote", ["add", "origin", _git._addAccessToken(gitUrl)]);
        },

        async _setUserInfo(name, email) {
            await _git.config(_fsPath, "user.name", name);
            await _git.config(_fsPath, "user.email", email);
            // Only push when specified where
            return _git.config(_fsPath, "push.default", "nothing");
        },

        _branchLineParser(line, result) {
            /*
                type of git branch output output this method can parse:

                * (detached from origin/widgets)                    5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles      // Will be ignored
                master                                            dccd034849028653a944d0f82842f802080657bb Update palette and matte
                montagestudio/{username}/master                   dccd034849028653a944d0f82842f802080657bb Update palette and matte      // local shadow branch
                remotes/origin/montagestudio/{username}/master    dccd034849028653a944d0f82842f802080657bb Update palette and matte      // remote shadow branch
                remotes/fork/markdown-editor                      799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor
                remotes/origin/HEAD                               -> origin/master                                                       // Will be ignored
            */
            const parsedLine = line.match(/([ *]+)(\([^)]+\)|[^ ]+)[ ]+([^ ]+)[ ]+(.*)/);
            if (parsedLine.length === 5) {
                const current = (parsedLine[1] === "* ");
                let fullPath = parsedLine[2];
                const sha = parsedLine[3];
                // const commitComment = parsedLine[4];
                let shadowBranch = false;
                if (sha !== "->" && fullPath.charAt(0) !== "(") {   // Skip alias branch (like HEAD) and detached branch
                    const _REMOTES_PREFIX = "remotes/";
                    let origin,
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
                    let repo = result.branches[origin];
                    if (!repo) {
                        result.branches[origin] = repo = {};
                    }
                    let branch = repo[branchName];
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
        },

        async _listBranches(forceFetch) {
            await _gitFetch(forceFetch);
            const output = await _git.branch(_fsPath, ["-a", "-v", "--no-abbrev"]);
            const result = {
                current:null,
                branches:{}
            };
            output.split(/\r?\n/).forEach((line) => {
                if (line.length) {
                    this._branchLineParser(line, result);
                }
            });
            return result;
        },

        async _checkoutShadowBranch(branch = "master") {
            if (typeof branch !== "string") {
                throw new TypeError("Invalid checkoutWorkingBranch argument.");
            }
            let branchesInfo = await this._listBranches();
            // Checkout the branch if needed
            if (branchesInfo.current !== branch) {
                if (!branchesInfo.branches[LOCAL_SOURCE_NAME][branch]) {
                    // we do not have a local branch, make sure it exit remotely
                    if (!branchesInfo.branches[REMOTE_SOURCE_NAME][branch]) {
                        throw new Error("Unknown branch " + branch);
                    }
                }
                await _git.checkout(_fsPath, branch);    // will create the local branch and track the remote one if needed
                branchesInfo = await this._listBranches();
            }
            // Make sure we have a shadow branch
            const remoteModified = await this._createShadowBranch(branchesInfo);
            if (remoteModified || !branchesInfo.branches[LOCAL_SOURCE_NAME][branch].shadow) {
                // we need to refresh the branchesInfo
                branchesInfo = await this._listBranches();
            }
            // Checkout the shadow branch if needed
            if (!(branchesInfo.current === branch && branchesInfo.currentIsShadow)) {
                await _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
            }
        },

        async _shadowBranchStatus(branch, forceFetch) {
            branch = branch || "master"
            if (typeof branch !== "string") {
                return Q.reject(new Error("Invalid shadowBranchStatus argument."));
            }
            const result = {
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
            let shadowBranch = USER_SHADOW_BRANCH_PREFIX + branch;
            await _gitFetch(forceFetch);
            let status = await this._branchStatus(shadowBranch, branch);
            result.localParent = status;
            status = await this._branchStatus(shadowBranch, REMOTE_SOURCE_NAME + "/" + branch);
            result.remoteParent = status;
            status = await this._branchStatus(shadowBranch, REMOTE_SOURCE_NAME + "/" + shadowBranch);
            result.remoteShadow = status;
            return result;
        },

        async _commitFiles(fileUrls, message, remove, amend) {
            let files;
            // Convert fileUrls to relative paths
            if (fileUrls === null && remove !== true) {
                files = ["--all"];
            } else {
                if (!Array.isArray(fileUrls) ) {
                    throw new Error("Invalid commitFiles argument.");
                }
                files = fileUrls.map((url) => _convertProjectUrlToPath(url));
            }
            await (remove === true ? _git.rm(_fsPath, files) : _git.add(_fsPath, files));
            // make sure we have staged files before committing
            const hasStagedFile = await this._hasStagedChanges();
            if (hasStagedFile) {
                await _git.commit(_fsPath, message || "Update component", amend === true);
                const current = await _git.currentBranch(_fsPath);
                if (_gitAutoFlushTimer[current]) {
                    clearTimeout(_gitAutoFlushTimer[current]);
                }
                _gitAutoFlushTimer[current] = setTimeout(() => this.flush(current).done(), AUTO_FLUSH_TIMEOUT);
            }
            return { success: true };
        },

        async _commitBatch(batch) {
            let files;
            if (batch._addedFiles.length) {
                files = batch._addedFiles.map(_convertProjectUrlToPath);
                _git.add(_fsPath, files);
            }
            if (batch._removedFiles.length) {
                files = batch._removedFiles.map(_convertProjectUrlToPath);
                _git.rm(_fsPath, files);
            }
            // make sure we have staged files before committing
            const hasStagedFile = await this._hasStagedChanges();
            if (hasStagedFile) {
                await _git.commit(_fsPath, batch.message || "Update files");
                const current = await _git.currentBranch(_fsPath);
                if (_gitAutoFlushTimer[current]) {
                    clearTimeout(_gitAutoFlushTimer[current]);
                }
                _gitAutoFlushTimer[current] = setTimeout(() => this.flush(current).done(), AUTO_FLUSH_TIMEOUT);
            }
            return { success: true };
        },

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
        async _updateRefs(resolutionStrategy, reference = { step: 0 }, forceFetch) {
            let returnValue = {
                success: true
            };
            let branchesInfo = null,
                current,
                local,
                remote;

            const SHADOW_STEP = 1,
                PARENT_STEP = 2;

            // INIT_STEP: update branches and make sure we have shadow branches
            const hasUncommittedChanges = await this._hasUncommittedChanges(true)
            if (hasUncommittedChanges) {
                await this._recoverChanges();
            }
            // Fetch and retrieve the branches and their refs
            branchesInfo = await this._listBranches(forceFetch);
            current = branchesInfo.current;
            local = branchesInfo.branches[LOCAL_SOURCE_NAME][current];
            remote = branchesInfo.branches[REMOTE_SOURCE_NAME][current];

            if (!branchesInfo.currentIsShadow || !local.shadow || !remote.shadow) {
                await this._checkoutShadowBranch(current)
                branchesInfo = await this._listBranches();
                current = branchesInfo.current;
            }

            // SHADOW_STEP: Sync the local shadow branch with the remote shadow branch
            if (returnValue.success && reference.step <= SHADOW_STEP) {
                const result = await this._syncBranches(branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow,
                    branchesInfo.branches[REMOTE_SOURCE_NAME][current].shadow,
                    reference.step === SHADOW_STEP ? resolutionStrategy : null,
                    true);
                if (result.success) {
                    // update the local shadow branch SHA
                    branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow.sha =
                        branchesInfo.branches[REMOTE_SOURCE_NAME][current].shadow.sha;
                } else {
                    returnValue = result;
                    returnValue.reference = {step: SHADOW_STEP};
                }
            }

            // PARENT_STEP: Sync the local shadow branch with the remote parent branch (one way only)
            if (returnValue.success && reference.step <= PARENT_STEP) {
                const result = await this._syncBranches(branchesInfo.branches[LOCAL_SOURCE_NAME][current].shadow,
                    branchesInfo.branches[REMOTE_SOURCE_NAME][current],
                    // Inherit previous state stategy resolution only if it's rebase
                    reference.step === PARENT_STEP ? resolutionStrategy : resolutionStrategy === "rebase" ? "rebase" : null);
                if (!result.success) {
                    returnValue = result;
                    returnValue.reference = {step: PARENT_STEP};
                }
            }

            // FINALIZE_STEP: force push shadow and reset local parent
            if (returnValue.success) {
                branchesInfo = await this._listBranches()
                current = branchesInfo.current;
                local = branchesInfo.branches[LOCAL_SOURCE_NAME][current];
                remote = branchesInfo.branches[REMOTE_SOURCE_NAME][current];

                if (local.shadow.sha !== remote.shadow.sha) {
                    return this._push(local.shadow.name, "--force");    // TODO: We should be using --force-with-lease (git 1.8.5)
                }
                if (local.sha !== remote.sha) {
                    try {
                        await _git.checkout(_fsPath, local.name);
                        await _git.command(_fsPath, "reset", ["--hard", remote.sha]);
                    } finally {
                        await _git.checkout(_fsPath, local.shadow.name);
                    }
                }
            }
            return returnValue;
        },

        async _syncBranches(local, remote, resolutionStrategy, autoMerge) {
            const returnValue = {
                success: true,
                local: local.name,
                remote: remote.name
            };

            if (local.sha !== remote.sha) {
                const status = await this._branchStatus(local.name, remote.name);
                if (resolutionStrategy === "rebase") {
                    /*
                        Rebase the local branch on the remote branch
                        */
                    const success = await this._rebase(local.name, remote.name);
                    if (!success) {
                        // We cannot rebase, let's propose other solutions
                        returnValue.success = false;
                        returnValue.resolutionStrategy = autoMerge === true ? ["discard", "revert", "force"] : ["discard", "revert"];
                        returnValue.ahead = status.ahead;
                        returnValue.behind = status.behind;
                    }
                } else if (resolutionStrategy === "discard") {
                    /*
                        Discard local changes
                        */
                    await _git.command(_fsPath, "reset", ["--hard", remote.sha]);
                } else if (resolutionStrategy === "revert") {
                    /*
                        Revert remote changes
                        */
                    try {
                        if (REMOTE_SOURCE_NAME + "/" + local.name === remote.name) {
                            await this._revertRemoteChanges(local.name, remote.name, status);
                        } else {
                            await this._revertParentChanges(local.name, remote.name, status);
                        }
                    } catch (error) {
                        log("Revert remote changes failed:", error.stack);
                        throw new Error("Revert remote changes failed: " + error.message);
                    }
                } else if (resolutionStrategy === "force") {
                    /*
                        Destroy remote changes
                        */
                    if (autoMerge !== true) {
                        throw new Error("Cannot update the remote repository, try to merge instead");
                    }
                    await this._push(local.name, "--force");   // TODO: We should be using --force-with-lease (git 1.8.5)
                } else {
                    // Default
                    if (status.behind === 0) {
                        // The local branch is ahead of the remote branch, let's just push it
                        if (autoMerge === true) {
                            await this._push(local.name);
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
                            const success = await this._rebase(local.name, remote.name, local.sha);
                            returnValue.resolutionStrategy = autoMerge === true ? ["discard", "revert", "force"] : ["discard", "revert"];
                            if (success) {
                                returnValue.resolutionStrategy.unshift("rebase");
                            }
                        }
                    }
                }
            }
            return returnValue;
        },

        async _mergeShadowBranch(branch, message, squash) {
            let branchesInfo;

            squash = squash === true ? true: false; // Sanitize value, git.merge is very picky about it

            branchesInfo = await this._listBranches(true);
            // Make sure we have a shadow branch
            if (!branchesInfo.branches[LOCAL_SOURCE_NAME][branch] || !branchesInfo.branches[LOCAL_SOURCE_NAME][branch].shadow) {
                throw new Error("Invalid branch");
            }
            // Make sure we have something to merge...
            const status = await this._branchStatus(branch, USER_SHADOW_BRANCH_PREFIX + branch);
            _gitFetchLastTimeStamp = 0;

            if (status.behind > 0) {
                try {
                    await _git.checkout(_fsPath, branch);
                    // git merge <shadow branch> [--squash]
                    try {
                        await _git.merge(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch, squash);
                    } catch (error) {
                        await _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_SOURCE_NAME][branch].sha]);
                        throw error;
                    }
                    // git commit -m <message>
                    if (squash) {
                        await _git.commit(_fsPath, message || "merge changes");
                    }
                    try {
                        await this._push(branch);
                    } catch (error) {
                        await _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[LOCAL_SOURCE_NAME][branch].sha]);
                        throw error;
                    }
                    // git checkout <shadow branch>
                    await _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
                    // reset the shadow branch after a squash
                    if (squash) {
                        await _git.command(_fsPath, "reset", ["--hard", branch]);
                        await this._push(USER_SHADOW_BRANCH_PREFIX + branch, "--force");
                    }
                } catch (error) {
                    // checkout the shadow branch, just in case we are still on the parent branch
                    _git.checkout(_fsPath, USER_SHADOW_BRANCH_PREFIX + branch);
                    throw error;
                }
            }
            return true;
        },

        async _flush(branch) {
            try {
                const current = await _git.currentBranch(_fsPath);
                let result;
                try {
                    branch = branch || current;
                    await this._push(branch);
                    result = { success: true };
                } catch (e) {
                    // An error occurs when pushing, let's see if we can just rebase it
                    result = await this._flushRebase(branch);
                }
                try {
                    await Frontend.dispatchEventNamed("repositoryFlushed", true, true, result)
                } catch (error) {
                    console.error(error);
                }
            } finally {
                if (_gitAutoFlushTimer[branch]) {
                    clearTimeout(_gitAutoFlushTimer[branch]);
                    _gitAutoFlushTimer[branch] = null;
                }
            }
        },

        async _flushRebase(branch) {
            await _gitFetch(true);
            const success = await this._rebase(branch, REMOTE_SOURCE_NAME + "/" + branch);
            if (success) {
                // Rebase was successful, let push it
                try {
                    await this._push(branch);
                    return { success: true };
                } catch (error) {
                    return { success: false };
                }
            } else {
                return { success: false };
            }
        },

        async _branchStatus(localBranch, remoteBranch) {
            const [ behind, ahead ] = await Promise.all([
                _git.command(_fsPath, "rev-list", ["--first-parent", localBranch + ".." + remoteBranch, "--count"], true),
                _git.command(_fsPath, "rev-list", ["--first-parent", remoteBranch + ".." + localBranch, "--count"], true)
            ]);
            return {
                behind: parseInt(behind, 10),
                ahead: parseInt(ahead, 10)
            };
        },

        async _status() {
            const output = await _git.status(_fsPath, ["--porcelain"]);
            const result = [];
            output.split(/\r?\n/).forEach((line) => {
                if (line.length) {
                    const parsedLine = line.match(/([ MADRCU?!])([ MADRCU?!]) (.*)/);
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
        },

        /*
            _status returns a source and destination flag for all files that are either new, modified, removed, staged,
            untracked or to be ignored.
            To determine is a file need to be committed (whatever it has been already staged or not), we need make sure
            the dest status is not '!' (to be ignored), untracked (new file not yet staged) file will have a dest set to '?'
            ('?' means untracked and '!' means ignore).
        */
        async _hasUncommittedChanges(checkForUntrackedFile) {
            const result = await this._status();
            let uncommittedChanges = false;
            result.some((item) => {
                if (item.dest !== "!" && (item.dest !== "?" || checkForUntrackedFile === true)) {
                    uncommittedChanges = true;
                    return true;
                }
            });
            return uncommittedChanges;
        },

        /*
            _status returns a source and destination flag for all files that are either new, modified, removed, staged,
            untracked or to be ignored.
            To determine if a file has been staged, you need to make sure it has a src status and its value is neither '?'
            nor '!' ('?' means untracked and '!' means ignore).
        */
        async _hasStagedChanges() {
            const result = await this._status();
            let hasStagedFile = false;
            result.some((item) => {
                if (item.src.length === 1 && item.src !== "!" && item.src !== "?") {
                    hasStagedFile = true;
                    return true;
                }
            });
            return hasStagedFile;
        },

        async _hasConflicts() {
            const result = await this._status();
            let hasConflicts = false;
            result.some((item) => {
                if (item.src === "U" && item.dest === "U") {
                    hasConflicts = true;
                    return true;
                }
            });
            return hasConflicts;
        },

        /*
            _createShadowBranch will create the shadow branch either from scratch, or from a remote shadow branch or from an
            old naming convention shadow branch (for backward compatibility)
        */
        async _createShadowBranch(branchesInfo) {
            const OLD_USER_SHADOW_BRANCH_PREFIX = OLD_SHADOW_BRANCH_PREFIX + _owner + OLD_SHADOW_BRANCH_SUFFIX;

            if (!branchesInfo) {
                branchesInfo = await this._listBranches(true);
            }
            let currentBranch = branchesInfo.current;

            // if the current branch is the old shadow branch, let's correct the intended branch name
            if (currentBranch.indexOf(OLD_USER_SHADOW_BRANCH_PREFIX) === 0) {
                currentBranch = branchesInfo.current = currentBranch.substring(OLD_USER_SHADOW_BRANCH_PREFIX.length);
            }
            const local = branchesInfo.branches[LOCAL_SOURCE_NAME] ?
                    branchesInfo.branches[LOCAL_SOURCE_NAME][currentBranch] : null,
                remote = branchesInfo.branches[REMOTE_SOURCE_NAME] ?
                    branchesInfo.branches[REMOTE_SOURCE_NAME][currentBranch] : null;
            let remoteModified = false;

            if (!local || !remote) {
                throw new Error("Missing local or remote " + currentBranch + " branch");
            }

            if (local.shadow) {
                if (!remote.shadow) {
                    // Remote shadow branch missing, let's push it
                    await this._push(USER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
                }
            } else if (remote.shadow) {
                // Create a local branch that track the remote shadow branch
                await _git.branch(_fsPath, ["--track", USER_SHADOW_BRANCH_PREFIX + currentBranch, remote.shadow.name]);
            } else {
                // We do not have a local or remote shadow branch yet. But before creating a new branch,
                // let's check if we have a branch that uses the old shadow branch naming convention and recycle it
                let oldShadowBranchName = OLD_SHADOW_BRANCH_PREFIX + _owner + OLD_SHADOW_BRANCH_SUFFIX + currentBranch,
                    oldLocalShadow = branchesInfo.branches[LOCAL_SOURCE_NAME] ?
                        branchesInfo.branches[LOCAL_SOURCE_NAME][oldShadowBranchName] : null,
                    oldRemoteShadow = branchesInfo.branches[REMOTE_SOURCE_NAME] ?
                        branchesInfo.branches[REMOTE_SOURCE_NAME][oldShadowBranchName] : null;

                // <!-- backward compatibility code, can be removed in the future...
                if (oldRemoteShadow) {
                    let status;
                    if (!oldLocalShadow || (oldLocalShadow.sha === oldRemoteShadow.sha)) {
                        status = { behind: 0, ahead: 0 };
                    } else {
                        status = await this._branchStatus(oldLocalShadow.name, oldRemoteShadow.name);
                    }
                    if (status.behind === 0) {
                        // We can safely delete the old remote shadow branch
                        await this._push(":" + oldShadowBranchName);
                        oldRemoteShadow = null;
                    }
                }
                // ...backward compatibility code, can be removed in the future -->
                // <!-- backward compatibility code, can be removed in the future...
                if (oldRemoteShadow && !oldLocalShadow) {
                    // checkout the old remote using the new shadow name
                    await _git.command(_fsPath, "checkout", [oldRemoteShadow.name, "-b", USER_SHADOW_BRANCH_PREFIX + currentBranch]);
                } else if (oldLocalShadow) {
                    // Rename local branch
                    await _git.command(_fsPath, "branch", ["-m", oldShadowBranchName, USER_SHADOW_BRANCH_PREFIX + currentBranch]);
                } else
                // ...backward compatibility code, can be removed in the future -->
                {
                    // create a new shadow branch locally
                    await _git.branch(_fsPath, ["--no-track", USER_SHADOW_BRANCH_PREFIX + currentBranch, remote.name]);
                }
                // Push the shadow branch to the remote and track it
                remoteModified = true;
                await this._push(USER_SHADOW_BRANCH_PREFIX + currentBranch, "-u");
            }
            return remoteModified;
        },

        async _revertRemoteChanges(local, remote, status) {
            let stashed = false;
            await this._listBranches();
            const uncommittedChanges = await this._hasUncommittedChanges();
            if (uncommittedChanges) {
                await _git.command(_fsPath, "stash", ["save", "local changes"]);
                stashed = true;
            }
            if (!status) {
                status = await this._branchStatus(local, remote);
            }
            if (status.behind > 0) {
                // Before we can revert, we need to move away our local commits
                if (status.ahead > 0) {
                    await _git.command(_fsPath, "reset", ["--soft", "HEAD~" + status.ahead]);
                    await _git.command(_fsPath, "stash", ["save", "local commits"]);
                    await this._rebase(local, remote);
                }

                // Let's revert the remote changes
                await _git.command(_fsPath, "revert", ["HEAD~" + status.behind + "..HEAD"]);
                if (status.ahead > 0) {
                    await _git.command(_fsPath, "stash", ["pop"])
                    await _git.command(_fsPath, "commit", ["-a", "-m", "replay local commits"]);
                }
                // push the parent
                return this._push(local);
            }
            if (stashed) {
                return _git.command(_fsPath, "stash", ["pop"]);
            }
        },

        async _revertParentChanges(local, remote, status) {
            let parentBranch,
                shadowBranch,
                branchesInfo;
            branchesInfo = await this._listBranches();
            const index = remote.indexOf("/");
            shadowBranch = local;
            parentBranch = remote.substring(index + 1);
            if (!status) {
                status = await this._branchStatus(local, remote);
            }
            try {
                // checkout the parent branch
                await _git.checkout(_fsPath, parentBranch);
                // reset the local parent branch to match the remote parent
                await _git.command(_fsPath, "reset", ["--hard", branchesInfo.branches[REMOTE_SOURCE_NAME][parentBranch].sha]);
                // revert parent changes
                await _git.command(_fsPath, "revert", ["HEAD~" + status.behind + "..HEAD"]);
                // push the parent
                await this._push(parentBranch);
                // force fetch in order to be able to properly rebase
                await _gitFetch(true);
                // Get back on the shadow branch
                await _git.checkout(_fsPath, shadowBranch);
                // now, we can safely rebase the shadow on the parent
                await this._rebase(shadowBranch, remote);
            } finally {
                // In case something went wrong earlier, make sure we go back to the shadow branch
                await _git.checkout(_fsPath, shadowBranch);
            }
        },

        async _push(local, options) {
            const repoUrl = await this._getRepositoryUrl();
            await _git.push(_fsPath, repoUrl, local, options);
            _gitFetchLastTimeStamp = 0;
        },

        async _rebase(local, remote, dryRunSha) {
            const options = [remote, local];
            try {
                await _git.command(_fsPath, "rebase", options);
                if (dryRunSha) {
                    await _git.command(_fsPath, "reset", ["--hard", dryRunSha]);
                }
                return true;
            } catch (e) {
                try {
                    await _git.command(_fsPath, "rebase", "--abort");
                } catch (e) {}
                return false;
            }
        },

        async _reset(ref) {
            let currentBranchName;
            const { current, currentIsShadow } = await this._listBranches(true);     // Will cause to do a git fetch
            currentBranchName = current;
            if (currentIsShadow) {
                currentBranchName = this.USER_SHADOW_BRANCH_PREFIX + currentBranchName;
            }
            try {
                await _git.command(_fsPath, "reset", ["--hard", ref ? ref : "HEAD"]);
                await this._push(currentBranchName, "--force");
                return true;
            } catch (error) {
                log("push failed", error.stack);
                return false;
            }
        },

        async _setupRepoWatch() {
            if (_githubPollTimer === null) {
                let eTag = 0,
                    pollInterval = 0;

                const _pollGithub = async () => {
                    try {
                        const response = await _githubApi.getRepositoryEvents(_owner, _repo, eTag);
                        const prevEtag = eTag;
                        eTag = response.etag;
                        pollInterval = response['x-poll-interval']; // we should respect the poll interval provided by github
                        if (prevEtag !== 0) {
                            /* We could check the response for any push events done after our last push but the easy way
                                is just to retrieves the branches info and check their refs
                                */
                            const info = await this.listBranches(true);
                            const currentBranch = info.current,
                                branches = info.branches,
                                localBranch = branches[LOCAL_SOURCE_NAME][currentBranch],
                                remoteBranch = branches[REMOTE_SOURCE_NAME][currentBranch];

                            if (remoteBranch && ((localBranch.sha !== remoteBranch.sha)) ||
                                    (remoteBranch.shadow && (localBranch.shadow.sha !== remoteBranch.shadow.sha))) {
                                const detail = {};
                                detail.localRef = localBranch.sha;
                                detail.localShadowRef = localBranch.shadow ? localBranch.shadow.sha : undefined;
                                if (remoteBranch) {
                                    detail.remoteRef = remoteBranch.sha;
                                    detail.remoteShadowRef = remoteBranch.shadow ? remoteBranch.shadow.sha : undefined;
                                }
                                try {
                                    await Frontend.dispatchEventNamed("remoteChange", true, true, detail);
                                } catch (error) {
                                    console.error(error);
                                }
                            }
                        }
                    } catch (e) {
                    } finally {
                        pollInterval = pollInterval || 60;  // In case of failure before we had time to get the poll interval, just set it to 60 secs
                        _githubPollTimer = setTimeout(_pollGithub, pollInterval * 1000);
                    }
                };
                _pollGithub();
            }
        },

        async _recoverChanges() {
            const batch = this.openCommitBatch("auto-recovery");
            let hasChanges = false;

            const result = await this._status();
            result.forEach((item) => {
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
            if (hasChanges) {
                batch.commit();
            } else {
                batch.release();
            }
        },

        close () {
            delete _cachedServices[serviceUUID];
            if (_githubPollTimer) {
                clearTimeout(_githubPollTimer);
                _githubPollTimer = null;
            }
        },

        get LOCAL_SOURCE_NAME() {
            return LOCAL_SOURCE_NAME;
        },

        get REMOTE_SOURCE_NAME() {
            return REMOTE_SOURCE_NAME;
        },

        get USER_SHADOW_BRANCH_PREFIX() {
            return USER_SHADOW_BRANCH_PREFIX;
        }
    });

    /**
     * Setup a brand new project
     */
    service.setupProject = _checkGithubError(semaphore.exclusive(function () { return this._setupProject(); }));

    /**
     * setup a project by cloning it from github
     */
    service.cloneProject = _checkGithubError(semaphore.exclusive(function () { return this._cloneProject(); }));

    /**
     * setup a project by cloning it from a local template
     */
    service.cloneTemplate = _checkGithubError(semaphore.exclusive(function (path) { return this._cloneTemplate(path); }));

    /**
     * Return an object describing all branches (local and remotes) as well the current
     * branch (checked out). If a shadow branch is checked out, current will represent
     * the name of the parent branch and the property currentIsShadow is set to true.
     *
     * Shadow branches are represented as an attribute of their parent branch and are
     * not listed on their own
     *
     * argument:
     *      forceFetch: [optional] pass true to force a fetch, else the will decide if it needs to fetch or not
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
    service.listBranches = _checkGithubError(semaphore.exclusive(function (forceFetch) { return this._listBranches(forceFetch); }));

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
    service.checkoutShadowBranch = _checkGithubError(semaphore.exclusive(function(branch) { return this._checkoutShadowBranch(branch); }));

    /**
     * Return the status of the local shadow branch compared to the local
     * parent branch and the remote parent branch.
     *
     * argument:
     *      branch: branch name to checkout (without shadow branch prefix)
     *      forceFetch: [optional] pass true to force a fetch, else the will decide if it needs to fetch or not
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
    service.shadowBranchStatus = _checkGithubError(semaphore.exclusive(function (branch, forceFetch) { return this._shadowBranchStatus(branch, forceFetch); }));

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
    service.commitFiles = _checkGithubError(semaphore.exclusive(function (fileUrls, message, remove, amend) {
        return this._commitFiles(fileUrls, message, remove, amend);
    }));

    /**
     * Commit a batch to the current branch and schedule a push to the
     * remote repository. Make sure to call checkoutShadowBranch before.
     *
     * return: promise
     */
    service.commitBatch = _checkGithubError(semaphore.exclusive(function (batch) { return this._commitBatch(batch); }));

    /**
     * Pushes the commits from the specified or current branch to the remote repository.
     *
     * return: promise
     */
    service.flush = _checkGithubError(semaphore.exclusive(function(branch) { return this._flush(branch); }));

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
     *      forceFetch: [optional] pass true to force a fetch, else the will decide if it needs to fetch or not
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

    // Install github watch
    service._setupRepoWatch();

    return service;
}
