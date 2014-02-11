var exec = require('child_process').exec;
var MockFs = require("q-io/fs-mock");
var Git = require("../../../project/git");
var RepositoryService = require("../../../project/services/repository-service");

describe("repository-service", function () {
    var fs, tmpPath, repoPath, session, git, service;

    tmpPath = "/tmp/repository-service-spec-" + Date.now() + Math.floor(Math.random() * 999999);
    repoPath = tmpPath + "/branchRepo";

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

    // Unzip test repo and clone it
    exec("unzip -d " + tmpPath + " ./spec/fixtures/repos/branchRepo.zip", function() {
        exec("git clone " + tmpPath + "/branchRepo.git " + repoPath, function() {
            git = new Git(fs, session.githubAccessToken);
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
                    /* branchRepo branches:

                        * master                      8b475dd4af6358024da1845895a773903788c165 How to compress the test repository
                          remotes/origin/HEAD         -> origin/master
                          remotes/origin/__mb__master 3dd4bfcd018655a5e8b4c5a9516fab635052a400 Initial commit
                          remotes/origin/experimental 3dd4bfcd018655a5e8b4c5a9516fab635052a400 Initial commit
                          remotes/origin/master       8b475dd4af6358024da1845895a773903788c165 How to compress the test repository
                     */

                    service.listBranches()
                    .then(function(result) {
                        expect(typeof result).toBe("object");
                        expect(typeof result.branches).toBe("object");
                        expect(result.current).toBe("master");

                        var master = result.branches[service.LOCAL_REPOSITORY_NAME][result.current];
                        expect(typeof master).toBe("object");
                        expect(typeof master.sha).toBe("string");
                        expect(master.shadow).toBeNull();

                        expect(Object.keys(result.branches[service.REMOTE_REPOSITORY_NAME]).length).toBe(2);

                        master = result.branches[service.REMOTE_REPOSITORY_NAME][result.current];
                        expect(typeof master).toBe("object");
                        expect(typeof master.sha).toBe("string");
                        expect(typeof master.shadow).toBe("object");
                        expect(master.shadow.name).toBe("remotes/" + service.REMOTE_REPOSITORY_NAME + "/" + service.SHADOW_BRANCH_PREFIX + "master");
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
                    service._branchLineParser(
                        "* (detached from origin/widgets)         5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles", result);
                    expect(result.current).toBeNull();
                    expect(Object.keys(result.branches).length).toBe(0);
                    done();
                });

                it ("can parse a local master (not checked out) branch", function(done) {
                    service._branchLineParser(
                        "  master                                 dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
                    expect(result.current).toBeNull();
                    expect(Object.keys(result.branches).length).toBe(1);
                    expect(Object.keys(result.branches)[0]).toBe(service.LOCAL_REPOSITORY_NAME);

                    var branch = result.branches[service.LOCAL_REPOSITORY_NAME].master;
                    expect(typeof branch).toBe("object");
                    expect(branch.name).toBe("master");
                    expect(typeof branch.sha).toBe("string");
                    expect(branch.shadow).toBeNull();
                    done();
                });

                it ("can parse a local checked out shadow master branch", function(done) {
                    service._branchLineParser(
                        "* " + service.SHADOW_BRANCH_PREFIX +
                        "master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
                    expect(result.current).toBe("master");

                    var branch = result.branches[service.LOCAL_REPOSITORY_NAME].master;
                    expect(typeof branch).toBe("object");
                    expect(branch.name).toBe("master");
                    expect(typeof branch.shadow).toBe("object");
                    expect(branch.shadow.name).toBe(service.SHADOW_BRANCH_PREFIX + "master");
                    expect(typeof branch.shadow.sha).toBe("string");
                    done();
                });

                it ("can parse a remote branch", function(done) {
                    service._branchLineParser(
                        "  remotes/fork/markdown-editor           799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor", result);
                    expect(result.current).toBe("master");    // The current should not change
                    expect(Object.keys(result.branches).length).toBe(2);
                    expect(typeof result.branches.fork).toBe("object");

                    var branch = result.branches.fork["markdown-editor"];
                    expect(branch.name).toBe("remotes/fork/markdown-editor");
                    expect(typeof branch.sha).toBe("string");
                    expect(branch.shadow).toBeNull();
                    done();
                });

                it ("can ignore an alias branch", function(done) {
                    var nbrBranches = Object.keys(result.branches).length;
                    service._branchLineParser(
                        "  remotes/origin/HEAD                    -> origin/master", result);
                    expect(result.current).toBe("master");    // The current should not change
                    expect(Object.keys(result.branches).length).toBe(nbrBranches);
                    done();
                });
            });

            // The following describe must be declared last.
            describe("cleanup", function() {
                it ("cleanups", function(done) {
                    exec("cd /tmp; rm -Rf repository-service-spec-*", done);
                });
            });
        });
    });
});
