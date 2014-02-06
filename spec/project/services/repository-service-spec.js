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

        describe("branch line parser", function () {
            var result = {
                current:null,
                branches:[]
            };

            it ("can ignore a detached branch", function(done) {
                service._branchLineParser(
                    "* (detached from origin/widgets)         5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles", result);
                expect(result.current).toBeNull();
                expect(result.branches.length).toBe(0);
                done();
            });

            it ("can parse a local master (not checked out) branch", function(done) {
                service._branchLineParser(
                    "  master                                 dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
                expect(result.current).toBeNull();
                expect(result.branches.length).toBe(1);
                expect(typeof result.branches[0]).toBe("object");
                expect(result.branches[0].name).toBe("master");
                expect(typeof result.branches[0].local).toBe("object");
                expect(result.branches[0].remotes).not.toBeDefined();
                done();
            });

            it ("can parse a local checked out shadow master branch", function(done) {
                service._branchLineParser(
                    "* " + service.shadowBranchPrefix +
                    "master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte", result);
                expect(result.current).toBe(result.branches[0]);
                expect(typeof result.current.local.shadow).toBe("object");
                expect(result.current.local.shadow.name).toBe(service.shadowBranchPrefix + "master");
                done();
            });

            it ("can parse a remote branch", function(done) {
                service._branchLineParser(
                    "  remotes/fork/markdown-editor           799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor", result);
                expect(result.current).toBe(result.branches[0]);    // The current should not change
                expect(typeof result.branches[1]).toBe("object");
                expect(result.branches[1].name).toBe("markdown-editor");
                expect(typeof result.branches[1].remotes).toBe("object");
                expect(typeof result.branches[1].remotes.fork).toBe("object");
                done();
            });

            it ("can ignore an alias branch", function(done) {
                var nbrBranches = result.branches.length;
                service._branchLineParser(
                    "  remotes/origin/HEAD                    -> origin/master", result);
                expect(result.current).toBe(result.branches[0]);    // The current should not change
                expect(result.branches.length).toBe(nbrBranches);
                done();
            });
        });

        // The following describe must be declared last.
        describe("cleanup", function() {
            it ("cleanups", function(done) {
                exec("cd /tmp; rm -Rf repository-service-spec-*", function() {
                    done();
                });
            });
        });

    }).done();
});
