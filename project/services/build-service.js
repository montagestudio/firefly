const Q = require("q");
const GithubApi = require("../github-api");
const Git = require("../git");
const mop = require("../mop").mop;

const GITHUB_PAGES_DOMAIN = "github.io";
const GITHUB_PAGES_BRANCH = "gh-pages";
const GITHUB_PAGES_MESSAGE = "Publish build";
const DEFAULT_GIT_EMAIL = "noreply";
const semaphore = Git.semaphore;

module.exports = (config, fs, pathname, fsPath) => {
    const _owner = config.owner;
    const _repo = config.repo;
    const _git = new Git(fs, config.githubAccessToken, true);
    const _githubApi = new GithubApi(config.githubAccessToken);
    const _githubUser = config.githubUser;

    let repositoryUrlPromise;
    const getRepositoryUrl = async () => {
        if (!repositoryUrlPromise) {
            const deferred = Q.defer();
            repositoryUrlPromise = deferred.promise;
            _githubApi.getInfo(_owner, _repo).then(function(info) {
                return _git._addAccessToken(info.gitUrl);
            }).then(deferred.resolve, deferred.reject).done();
        }
        return repositoryUrlPromise;
    };

    const pushDirectoryToBranch = _githubApi.checkError(semaphore.exclusive(async (directory, branch, message, force) => {
        // TODO: should actually checkout gh-pages first if they exist and
        // remove everything before adding. This will make the publish much
        // slower and the end result is kind of the same. Living with this for
        // now.
        await _git.init(directory);
        // Configure user info
        const name = _githubUser.name || _githubUser.login;
        const email = _githubUser.email || DEFAULT_GIT_EMAIL;

        await _git.config(directory, "user.name", name);
        await _git.config(directory, "user.email", email);
        // Only push when specified where
        await _git.config(directory, "push.default", "nothing");
        // Allow large pushes (500MB)
        await _git.config(directory, "http.postBuffer", "524288000");
        await _git.add(directory, ["."]);
        await _git.commit(directory, message);
        const repoUrl = await getRepositoryUrl();
        await _git.push(directory, repoUrl, "HEAD:"+branch, force ? ["-f"] : void 0);
        await "http://" + _owner + "." + GITHUB_PAGES_DOMAIN + "/" + _repo;
    }), _owner);

    return {
        optimize(options) {
            const config = {};
            if (options.status) {
                config.out = {};
                config.out.status = createThrottlingStatusFunction(options.status);
            }
            if ("minify" in options) {
                config.minify = options.minify;
            }
            return mop.optimize(fsPath, config);
        },

        archive() {
            return mop.archive();
        },

        async publishToGithubPages() {
            const buildLocation = await mop.getBuildLocation();
            return pushDirectoryToBranch(buildLocation, GITHUB_PAGES_BRANCH, GITHUB_PAGES_MESSAGE, true);
        }
    }
}

function createThrottlingStatusFunction(statusFunction) {
    let previousMessage;

    return (status) => {
        let message;
        if (status) {
            // TODO: maybe mop can do this in the future? returning keys for the
            // status instead of an english sentence.
            if (status.indexOf("Reading") >= 0) {
                message = "Reading files...";
                message = "reading";
            } else {
                message = status.toLowerCase();
            }
            if (message !== previousMessage) {
                statusFunction(message);
                previousMessage = message;
            }
        }
    };
}
