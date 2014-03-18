var childProcess = require('child_process');
var exec = childProcess.exec;
var execFile = childProcess.execFile;
var PATH = require("path");
var Q = require("q");
var MockFs = require("q-io/fs-mock");
var MockGithubApi = require("../../mocks/github-api");
var FS = require("fs");
var Git = require("../../../container/git");
var RepositoryService = require("../../../container/services/repository-service").service;

var createRepo = function(repoName, destPath, repoDestName) {
    var deferred = Q.defer(),
        repoPath = destPath + "/" + (repoDestName ? repoDestName : repoName);

    // Unzip test repo and clone it
    if (FS.existsSync(destPath + "/" + repoName + ".git")) {
        exec("git clone " + destPath + "/" + repoName + ".git " + repoPath, function() {
            deferred.resolve(repoPath);
        });
    } else {
        exec("unzip -d " + destPath + " ./spec/fixtures/repos/" + repoName + ".zip", function() {
            exec("git clone " + destPath + "/" + repoName + ".git " + repoPath, function() {
                deferred.resolve(repoPath);
            });
        });
    }

    return deferred.promise;
};

var executeFile = function(scriptName, destPath) {
    var deferred = Q.defer();

    exec("cd ./spec/fixtures/repos/; chmod +x " + scriptName + "; pwd", function(error, stdout) {
        var scriptPath = PATH.join(stdout.trim(), scriptName);
        execFile(scriptPath, [destPath], function(error, stdout) {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(stdout);
            }
        });
    });

    return deferred.promise;
};

var writeFile = function(repoPath, fileName, data, append) {
    return Q.nfcall(append === true ? FS.appendFile : FS.writeFile, PATH.join(repoPath, fileName), data);
};

var readFile = function(repoPath, fileName, data) {
    return Q.nfcall(FS.readFile, PATH.join(repoPath, fileName), data)
    .then(function(result) {
        return result.toString();
    });
};



describe("repository-service", function () {
    var fs, tmpPath, serviceRepo1Path, serviceRepo2Path, session, git, service1, service2;

    tmpPath = "/tmp/repository-service-spec-" + Date.now() + Math.floor(Math.random() * 999999);

    session = {
        owner: "jasmine",
        repo: "sample",
        githubAccessToken: "free-pass"
    };

    // Setup a mock fs
    fs = MockFs({
        "core": {
            "core.js": ""
        },
        "package.json": "{}"
    });

    git = new Git(fs, session.githubAccessToken);

    describe("check branch setup", function () {
        it ("should have a repo", function(done) {
            createRepo("branchRepo", tmpPath).then(function(path) {
                serviceRepo1Path = path;
                service1 = RepositoryService(session.owner, session.githubAccessToken, session.repo, fs, serviceRepo1Path, false);
                service1.setGithubApi(new MockGithubApi());
            })
            .then(function() {
                git.isCloned(serviceRepo1Path)
                .then(function(isCloned) {
                    expect(isCloned).toBe(true);
                });
            })
            .then(done, done);
        });
    });

    describe("list branches", function () {
        it ("returns the different types of branches in the repo", function(done) {
            /* branchRepo branches:

                * master                                8b475dd4af6358024da1845895a773903788c165 How to compress the test repository
                  remotes/origin/HEAD                   -> origin/master
                  remotes/origin/__mb__master           3dd4bfcd018655a5e8b4c5a9516fab635052a400 Initial commit
                  remotes/origin/__mb__jasmine__master  3dd4bfcd018655a5e8b4c5a9516fab635052a400 Initial commit
                  remotes/origin/experimental           3dd4bfcd018655a5e8b4c5a9516fab635052a400 Initial commit
                  remotes/origin/master                 8b475dd4af6358024da1845895a773903788c165 How to compress the test repository
             */

            service1.listBranches()
            .then(function(result) {
                expect(typeof result).toBe("object");
                expect(typeof result.branches).toBe("object");
                expect(Object.keys(result.branches[service1.REMOTE_REPOSITORY_NAME]).length).toBe(2);
                expect(result.current).toBe("master");

                var master = result.branches[service1.LOCAL_REPOSITORY_NAME][result.current];
                expect(typeof master).toBe("object");
                expect(typeof master.sha).toBe("string");
                expect(master.shadow).toBeNull();

                expect(Object.keys(result.branches[service1.REMOTE_REPOSITORY_NAME]).length).toBe(2);

                master = result.branches[service1.REMOTE_REPOSITORY_NAME][result.current];
                expect(typeof master).toBe("object");
                expect(typeof master.sha).toBe("string");
                expect(typeof master.shadow).toBe("object");
                expect(master.shadow.name).toBe(service1.REMOTE_REPOSITORY_NAME + "/" + service1.OWNER_SHADOW_BRANCH_PREFIX + "master");
                expect(typeof master.shadow.sha).toBe("string");
            })
            .then(done, done);
        });
    });

    describe("branch line parser", function () {
        var result = {
            current: null,
            branches: {}
        };

        it ("can ignore a detached branch", function(done) {
            service1._branchLineParser(
                "* (detached from origin/widgets)         5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles", result);
            expect(result.current).toBeNull();
            expect(Object.keys(result.branches).length).toBe(0);
            done();
        });

        it ("can parse a local master (not checked out) branch", function(done) {
            service1._branchLineParser(
                "  master                                 dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
            expect(result.current).toBeNull();
            expect(Object.keys(result.branches).length).toBe(1);
            expect(Object.keys(result.branches)[0]).toBe(service1.LOCAL_REPOSITORY_NAME);

            var branch = result.branches[service1.LOCAL_REPOSITORY_NAME].master;
            expect(typeof branch).toBe("object");
            expect(branch.name).toBe("master");
            expect(typeof branch.sha).toBe("string");
            expect(branch.shadow).toBeNull();
            done();
        });

        it ("can parse a local checked out shadow master branch", function(done) {
            service1._branchLineParser(
                "* " + service1.OWNER_SHADOW_BRANCH_PREFIX +
                "master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
            expect(result.current).toBe("master");

            var branch = result.branches[service1.LOCAL_REPOSITORY_NAME].master;
            expect(typeof branch).toBe("object");
            expect(branch.name).toBe("master");
            expect(typeof branch.shadow).toBe("object");
            expect(branch.shadow.name).toBe(service1.OWNER_SHADOW_BRANCH_PREFIX + "master");
            expect(typeof branch.shadow.sha).toBe("string");
            done();
        });

        it ("can parse a remote branch", function(done) {
            service1._branchLineParser(
                "  remotes/fork/markdown-editor           799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor", result);
            expect(result.current).toBe("master");    // The current should not change
            expect(Object.keys(result.branches).length).toBe(2);
            expect(typeof result.branches.fork).toBe("object");

            var branch = result.branches.fork["markdown-editor"];
            expect(branch.name).toBe("fork/markdown-editor");
            expect(typeof branch.sha).toBe("string");
            expect(branch.shadow).toBeNull();
            done();
        });

        it ("can ignore an alias branch", function(done) {
            var nbrBranches = Object.keys(result.branches).length;
            service1._branchLineParser(
                "  remotes/origin/HEAD                    -> origin/master", result);
            expect(result.current).toBe("master");    // The current should not change
            expect(Object.keys(result.branches).length).toBe(nbrBranches);
            done();
        });
    });

    describe("check repository service setup", function () {
        it ("should have two repos", function(done) {
            executeFile("repo-service-setup.sh", tmpPath)
            .then(function() {
                serviceRepo1Path = PATH.join(tmpPath, "serviceRepo1");
                service1 = RepositoryService(session.owner, session.githubAccessToken, session.repo, fs, serviceRepo1Path, false);
                service1.setGithubApi(new MockGithubApi());

                serviceRepo2Path = PATH.join(tmpPath, "serviceRepo2");
                service2 = RepositoryService(session.owner, session.githubAccessToken, session.repo, fs, serviceRepo2Path, false);
                service2.setGithubApi(new MockGithubApi());

                service1._getRepositoryUrl = function() {
                    return Q.resolve(tmpPath + "/originServiceRepo");
                };
                service2._getRepositoryUrl = service1._getRepositoryUrl;

                git.isCloned(serviceRepo1Path)
                .then(function(isCloned) {
                    expect(isCloned).toBe(true);
                    expect(serviceRepo1Path).not.toBe(serviceRepo2Path);
                });
            })
            .then(function() {
                git.isCloned(serviceRepo2Path)
                .then(function(isCloned) {
                    expect(isCloned).toBe(true);
                });
            })
            .then(done, done);
        });
    });

    if (process.env.runSlowSpecs) {
        describe("checkoutShadowBranch", function () {
            it ("create a shadow branch and check it out", function(done) {
                service1.checkoutShadowBranch("master")
                .then(function() {
                    return service1.listBranches();
                })
                .then(function(branches) {
                    var localeMaster = branches.branches[service1.LOCAL_REPOSITORY_NAME].master,
                        remoteMaster = branches.branches[service1.REMOTE_REPOSITORY_NAME].master;
                    expect(branches.current).toBe("master");
                    expect(branches.currentIsShadow).toBeTruthy();
                    expect(remoteMaster.shadow).toBeDefined();
                    expect(remoteMaster.shadow.sha).toBe(localeMaster.shadow.sha);
                })
                .then(function() {
                    return service2.checkoutShadowBranch("master");
                })
                .then(done, done);
            });
        });

        describe("shadowBranchStatus", function () {
            it ("works (all refs the sames)", function(done) {
                service1.shadowBranchStatus()
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(0);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(0);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(0);

                })
                .then(done, done);
            });
        });

        describe("commitFiles (simple)", function () {
            var file1 = "sample1.txt",
                file2 = "sample2.txt";

            it ("commit local change and push it to origin (repo 1)", function(done) {
                writeFile(serviceRepo1Path, file1, "A1\n")
                .then(function() {
                    return service1.commitFiles([file1], "initial commit from repo 1");
                })
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                    return service1.shadowBranchStatus();
                })
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(1);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(1);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(0);

                })
                .then(done, done);
            });

            it ("commit local change and push it to origin (repo 2)", function(done) {
                writeFile(serviceRepo2Path, file2, "A2\n")
                .then(function() {
                    return service2.commitFiles([file2], "initial commit from repo 2");
                })
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                })
                .then(done, done);
            });

            it ("is behind remote shadow", function(done) {
                service1.shadowBranchStatus()
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(1);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(1);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(1);

                })
                .then(done, done);
            });
        });

        describe("updateRefs (simple)", function () {
            it ("tries to merge remote shadow into local shadow", function(done) {
                return service1.updateRefs()
                .then(function(result) {
                    var notifications = result.notifications,
                        notification;

                    expect(result.success).toBeFalsy();
                    expect(notifications.length).toBe(1);
                    notification = notifications[0];
                    expect(notification.type).toBe("shadowsOutOfSync");
                    expect(notification.branch).toBe("master");
                    expect(notification.ahead).toBe(0);
                    expect(notification.behind).toBe(1);
                    expect(result.resolutionStrategy.length).toBe(1);
                    expect(result.resolutionStrategy[0]).toBe("rebase");
                })
                .then(done, done);
            });

            it ("rebase local shadow on top of remote shadow", function(done) {
                return service1.updateRefs("rebase")
                .then(function(result) {
                    var notifications = result.notifications;

                    expect(result.success).toBeTruthy();
                    expect(notifications.length).toBe(0);
                })
                .then(done, done);
            });

            it ("is on part with remote shadow and ahead of master by 2", function(done) {
                service1.shadowBranchStatus()
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(2);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(2);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(0);
                })
                .then(done, done);
            });
        });

        describe("commitFiles (conflict)", function () {
            var file1 = "sample1.txt";

            it ("commit local changes and push it to origin (repo 1)", function(done) {
                writeFile(serviceRepo1Path, file1, "A2\n")
                .then(function() {
                    return service1.commitFiles([file1], "second commit from repo 1");
                })
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                })
                .then(done, done);
            });

            it ("commit local change and try to push it to origin (repo 2)", function(done) {
                writeFile(serviceRepo2Path, file1, "B2\n")
                .then(function() {
                    return service2.commitFiles([file1], "second commit from repo 2");
                })
                .then(function(result) {
                    expect(result.success).toBeFalsy();
                    expect(result.ahead).toBe(1);
                    expect(result.behind).toBe(1);
                    expect(result.resolutionStrategy.length).toBe(3);
                    expect(result.resolutionStrategy.indexOf("discard")).not.toBe(-1);
                    expect(result.resolutionStrategy.indexOf("revert")).not.toBe(-1);
                    expect(result.resolutionStrategy.indexOf("force")).not.toBe(-1);
                })
                .then(done, done);
            });

            it ("discard local change", function(done) {
                service2.commitFiles([file1], "second commit from repo 2", "discard")
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                    return readFile(serviceRepo2Path, file1);
                })
                .then(function(data) {
                    expect(data).toBe("A2\n");
                    return service2.shadowBranchStatus();
                })
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(3);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(3);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(0);
                })
                .then(done, done);
            });

            it ("commit local change and try to push it to origin (repo 2)", function(done) {
                git.command(serviceRepo2Path, "reset", ["--hard", "HEAD~1"])
                .then(function() {
                    writeFile(serviceRepo2Path, file1, "C2\n");
                })
                .then(function() {
                    return service2.commitFiles([file1], "second commit from repo 2");
                })
                .then(function(result) {
                    expect(result.success).toBeFalsy();
                    expect(result.ahead).toBe(1);
                    expect(result.behind).toBe(1);
                    expect(result.resolutionStrategy.length).toBe(3);
                    expect(result.resolutionStrategy.indexOf("discard")).not.toBe(-1);
                    expect(result.resolutionStrategy.indexOf("revert")).not.toBe(-1);
                    expect(result.resolutionStrategy.indexOf("force")).not.toBe(-1);
                })
                .then(done, done);
            });

            it ("revert remote change", function(done) {
                service2.commitFiles([file1], "second commit from repo 2", "revert")
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                    return readFile(serviceRepo2Path, file1);
                })
                .then(function(data) {
                    expect(data).toBe("C2\n");
                    return service2.shadowBranchStatus();
                })
                .then(function(status) {
                    expect(status.localParent.ahead).toBe(5);
                    expect(status.localParent.behind).toBe(0);
                    expect(status.remoteParent.ahead).toBe(5);
                    expect(status.remoteParent.behind).toBe(0);
                    expect(status.remoteShadow.ahead).toBe(0);
                    expect(status.remoteShadow.behind).toBe(0);
                })
                .then(done, done);
            });
        });
    }

    // The following describe must be declared last.
    describe("cleanup", function() {
        it ("cleanups", function(done) {
            exec("cd /tmp; rm -Rf repository-service-spec-*", done);
        });
    });
});
