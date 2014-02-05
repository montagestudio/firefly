var exec = require('child_process').exec;
var MockFs = require("q-io/fs-mock");
var Git = require("../../../project/git");
var RepositoryService = require("../../../project/services/repository-service");

describe("repository-service", function () {
    var fs, tmpPath, repoPath, session, git, service;

    tmpPath = "/tmp/repository-service-spec-" + Date.now() + Math.floor(Math.random() * 999999);
    repoPath = tmpPath + "/mousse";

    session = {
        githubAccessToken: "xxx"
    };

    // Setup a mock fs
    fs = MockFs({
        "core": {
            "core.js": ""
        },
        "package.json": "{}"
    });

    // Setup a git repository
    git = new Git(fs, session.githubAccessToken);
    git.clone("https://github.com/montagejs/mousse.git", repoPath)
    .then(function() {
        service = RepositoryService(session, fs, null, null, repoPath);

        describe("check setup", function () {
            it ("should have a repo", function(done) {
                git.isCloned(repoPath)
                .then(function(isCloned) {
                    expect(isCloned).toBe(true);
                })
                .then(done, done);
            });
        });

        describe("list branches", function () {
            it ("works", function(done) {
                service.listBranches()
                .then(function(result) {
                    expect(typeof result).toBe("object");
                    expect(typeof result.current).toBe("object");
                    expect(result.branches instanceof Array).toBeTruthy();
                    expect(result.current.name).toBe("master");

                    var master = null;
                    result.branches.some(function(branch) {
                        if (branch.name === "master") {
                            master = branch;
                            return true;
                        }
                        return false;
                    });
                    expect(result.current).toBe(master);
                    expect(typeof master.local).toBe("object");
                    expect(typeof master.local.sha).toBe("string");
                    expect(typeof master.remotes).toBe("object");
                    expect(typeof master.remotes.origin).toBe("object");
                    expect(typeof master.remotes.origin.sha).toBe("string");
                })
                .then(done, done);
            });
        });

        describe("cleanup", function() {
            it ("cleanups", function(done) {
                exec("cd /tmp; rm -Rf repository-service-spec-*", function() {
                    done();
                });
            });
        });
    }).done();
});
