var childProcess = require('child_process');
var exec = childProcess.exec;
var execFile = childProcess.execFile;
var PATH = require("path");
var Q = require("q");
var MockGithubApi = require("../../common/spec/mocks/github-api");
var fs = require("q-io/fs");
var FS = require("fs");
var Git = require("../../git");
var RepositoryService = require("../../services/repository-service").service;

var executeFile = function(scriptName, destPath, onlyLastLine) {
    var deferred = Q.defer();
    var reposPath = PATH.join(__dirname, "..", "fixtures", "repos");

    exec("cd " + reposPath + "; chmod +x " + scriptName + "; pwd", function(error, stdout) {
        var scriptPath = PATH.join(stdout.trim(), scriptName);
        execFile(scriptPath, [destPath], function(error, stdout) {
            if (error) {
                deferred.reject(error);
            } else {
                if (onlyLastLine) {
                    var lines = stdout.split("\n"),
                        lineCount = lines.length,
                        lastLine;

                    while (lineCount) {
                        lastLine = lines[-- lineCount];
                        if (lastLine.length) {
                            break;
                        }
                    }
                    stdout = lastLine || stdout;
                }
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
    var tmpPath, serviceRepo1Path, serviceRepo2Path, session, git, service1, service2;

    tmpPath = "/tmp/repository-service-spec-" + Date.now() + Math.floor(Math.random() * 999999);

    session = {
        username: "jasmine",
        owner: "owner",
        repo: "sample",
        githubAccessToken: "free-pass"
    };

    git = new Git(fs, session.githubAccessToken);

    describe("check branch setup", function () {
        it("should have a repo", function (done) {
            executeFile("repo-service-sample.sh", tmpPath, true).then(function (path) {
                serviceRepo1Path = path;
                service1 = RepositoryService(session.username, session.owner, session.githubAccessToken, session.repo, fs, serviceRepo1Path, false, null, new MockGithubApi());
            })
            .then(function () {
                return git.isCloned(serviceRepo1Path);
            })
            .then(function (isCloned) {
                expect(isCloned).toBe(true);
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
                expect(Object.keys(result.branches[service1.REMOTE_SOURCE_NAME]).length).toBe(2);
                expect(result.current).toBe("master");

                var master = result.branches[service1.LOCAL_SOURCE_NAME][result.current];
                expect(typeof master).toBe("object");
                expect(typeof master.sha).toBe("string");
                expect(master.shadow).toBeNull();

                expect(Object.keys(result.branches[service1.REMOTE_SOURCE_NAME]).length).toBe(2);

                master = result.branches[service1.REMOTE_SOURCE_NAME][result.current];
                expect(typeof master).toBe("object");
                expect(typeof master.sha).toBe("string");
                expect(typeof master.shadow).toBe("object");
                expect(master.shadow.name).toBe(service1.REMOTE_SOURCE_NAME + "/" + service1.USER_SHADOW_BRANCH_PREFIX + "master");
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
            expect(Object.keys(result.branches)[0]).toBe(service1.LOCAL_SOURCE_NAME);

            var branch = result.branches[service1.LOCAL_SOURCE_NAME].master;
            expect(typeof branch).toBe("object");
            expect(branch.name).toBe("master");
            expect(typeof branch.sha).toBe("string");
            expect(branch.shadow).toBeNull();
            done();
        });

        it ("can parse a local checked out shadow master branch", function(done) {
            service1._branchLineParser(
                "* " + service1.USER_SHADOW_BRANCH_PREFIX +
                "master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
            expect(result.current).toBe("master");

            var branch = result.branches[service1.LOCAL_SOURCE_NAME].master;
            expect(typeof branch).toBe("object");
            expect(branch.name).toBe("master");
            expect(typeof branch.shadow).toBe("object");
            expect(branch.shadow.name).toBe(service1.USER_SHADOW_BRANCH_PREFIX + "master");
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
        it("should have two repos", function(done) {
            executeFile("repo-service-setup.sh", tmpPath)
            .then(function() {
                service1.close(null);   // We need to close the service in order to reset it (as we use the same path)

                serviceRepo1Path = PATH.join(tmpPath, "serviceRepo1");
                service1 = RepositoryService(session.username, session.owner, session.githubAccessToken, session.repo, fs, serviceRepo1Path, false, null, new MockGithubApi());

                serviceRepo2Path = PATH.join(tmpPath, "serviceRepo2");
                service2 = RepositoryService(session.username, session.owner, session.githubAccessToken, session.repo, fs, serviceRepo2Path, false, null, new MockGithubApi());

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

    describe("checkoutShadowBranch", function () {
        it ("create a shadow branch and check it out", function(done) {
            service1.checkoutShadowBranch("master")
            .then(function() {
                return service1.listBranches();
            })
            .then(function(branches) {
                var localeMaster = branches.branches[service1.LOCAL_SOURCE_NAME].master,
                    remoteMaster = branches.branches[service1.REMOTE_SOURCE_NAME].master;
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
            .then(function() {
                return service1.flush();
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
            .then(function() {
                return service2.flush();
            })
            .then(function(result) {
                expect(result.success).toBeTruthy();
            })
            .then(done, done);
        });

        it ("is behind remote shadow", function(done) {
            service1.shadowBranchStatus(null, true)
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
        var reference;

        it ("tries to merge remote shadow into local shadow", function(done) {
            return service1.updateRefs()
            .then(function(result) {
                reference = result.reference;
                expect(result.success).toBeFalsy();
                expect(result.local).toBe("montagestudio/jasmine/master");
                expect(result.remote).toBe("origin/montagestudio/jasmine/master");
                expect(result.ahead).toBe(0);
                expect(result.behind).toBe(1);
                expect(result.resolutionStrategy.length).toBe(1);
                expect(result.resolutionStrategy[0]).toBe("rebase");
                expect(reference).toBeDefined();
            })
            .then(done, done);
        });

        it ("rebase local shadow on top of remote shadow", function(done) {
            return service1.updateRefs("rebase", reference)
            .then(function(result) {
                expect(result.success).toBeTruthy();
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
            .then(function() {
                return service1.flush();
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
            .then(function() {
                return service2.flush();
            })
            .then(function(result) {
                expect(result.success).toBeFalsy();
                return service2.updateRefs();
            }).then(function(result) {
                expect(result.success).toBeFalsy();
                expect(result.ahead).toBe(1);
                expect(result.behind).toBe(1);
                expect(result.reference).toBeDefined();
                expect(result.resolutionStrategy.length).toBe(3);
                expect(result.resolutionStrategy.indexOf("discard")).not.toBe(-1);
                expect(result.resolutionStrategy.indexOf("revert")).not.toBe(-1);
                expect(result.resolutionStrategy.indexOf("force")).not.toBe(-1);
            })
            .then(done, done);
        });

        it ("discard local change", function(done) {
            service2.updateRefs()
            .then(function(result) {
                return service2.updateRefs("discard", result.reference);
            })
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
            .then(function() {
                return service2.flush();
            })
            .then(function(result) {
                expect(result.success).toBeFalsy();
                return service2.updateRefs();
            }).then(function(result) {
                expect(result.ahead).toBe(1);
                expect(result.behind).toBe(1);
                expect(result.reference).toBeDefined();
                expect(result.resolutionStrategy.length).toBe(3);
                expect(result.resolutionStrategy.indexOf("discard")).not.toBe(-1);
                expect(result.resolutionStrategy.indexOf("revert")).not.toBe(-1);
                expect(result.resolutionStrategy.indexOf("force")).not.toBe(-1);
            })
            .then(done, done);
        });

        it ("revert remote change", function(done) {
            service2.updateRefs()
            .then(function(result) {
                return service2.updateRefs("revert", result.reference);
            })
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

    xdescribe("merge commits", function () {
        it ("reset service 1", function(done) {
            return service1.updateRefs("discard", null)
            .then(function() {
                return service2.updateRefs("discard", null);
            })
            .then(function(result) {
                return service1.listBranches();
            })
            .then(function(branchesInfo) {
                var remoteMaster = branchesInfo.branches[service1.REMOTE_SOURCE_NAME].master;
                return service1._reset(remoteMaster.sha);
            })
            .then(function(result) {
                return service1.shadowBranchStatus();
            })
            .then(function(status1) {
                return service2.shadowBranchStatus()
                .then(function(status2) {
                    expect(status1.localParent.ahead).toBe(0);
                    expect(status1.localParent.behind).toBe(0);
                    expect(status1.remoteParent.ahead).toBe(0);
                    expect(status1.remoteParent.behind).toBe(0);
                    expect(status1.remoteShadow.ahead).toBe(0);
                    expect(status1.remoteShadow.behind).toBe(0);

                    expect(status2.remoteParent.ahead).not.toBe(0);
                });
            })
            .then(done, done);
        });

        it ("can merge", function(done) {
            return service2.mergeShadowBranch("master", "jasmin test", true).then(function(success) {
                expect(success).toBeTruthy();
                return service1.updateRefs(null, null, true)
                .then(function(result) {
                    return service1.updateRefs("rebase", result.reference);
                })
                .then(function(result) {
                    expect(result.success).toBeTruthy();
                    return service1.listBranches();
                })
                .then(function(branchesInfo1) {
                    return service2.listBranches()
                    .then(function(branchesInfo2) {
                        expect(branchesInfo1.branches[service1.LOCAL_SOURCE_NAME].master.sha)
                            .toBe(branchesInfo2.branches[service2.LOCAL_SOURCE_NAME].master.sha);
                    });
                });
            })
            .then(done, done);
        });
    });

    // The following describe must be declared last.
    describe("cleanup", function() {
        it ("cleanups", function(done) {
            exec("cd /tmp; rm -Rf repository-service-spec-*", done);
        });
    });
});
