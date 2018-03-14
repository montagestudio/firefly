var Q = require("q");
var fs = require("q-io/fs");
var exec = require('child_process').exec;
var MockGithubApi = require("../common/spec/mocks/github-api");
var ProjectWorkspace = require("../project-workspace");
var Git = require("../git");

function createWorkspace(tmpPath, owner, repo) {
    return fs.makeTree(fs.join(tmpPath, owner, repo));
}

describe("ProjectWorkspace", function () {
    var projectWorkspace, tmpPath, owner, repo, config, githubUser,
        minitPath = fs.join(__dirname, "..", "..", "node_modules", "minit", "minit");

    beforeEach(function () {
        githubUser = {login: "jdoe"};
        tmpPath = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
        config = {
            username: "jdoe",
            githubUser: githubUser
        };
        owner = "owner";
        repo = "repo";
        var workspacePath = fs.join(tmpPath, owner, repo);
        projectWorkspace = new ProjectWorkspace(config, workspacePath, owner, repo, minitPath, new MockGithubApi());
    });

    afterEach(function(done) {
        exec("cd /tmp; rm -Rf git-clone-spec-*", done);
    });

    xit("template", function(done) {
        return projectWorkspace.createWorkspace()
        .then(function() {
            return projectWorkspace._git.init(projectWorkspace._workspacePath);
        }).then(done, done);
    });

    describe("setup repository workspace", function() {
        var _git = new Git(fs, "");

        it("creates git config with login and default email", function(done) {
            spyOn(projectWorkspace, "_npmInstall");

            return _git.init(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace._setupWorkspaceRepository();
            })
            .then(function() {
                return fs.read(fs.join(projectWorkspace._workspacePath, ".git", "config"));
            })
            .then(function(config) {
                expect(config.indexOf('[user]')).not.toBe(-1);
                expect(config.indexOf("name = jdoe")).not.toBe(-1);
            })
            .then(done, done);
        });

        it("creates git config with name and default email", function(done) {
            spyOn(projectWorkspace, "_npmInstall");

            githubUser.name = "John Doe";

            return _git.init(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace._setupWorkspaceRepository();
            })
            .then(function() {
                return fs.read(fs.join(projectWorkspace._workspacePath, ".git", "config"));
            })
            .then(function(config) {
                expect(config.indexOf('[user]')).not.toBe(-1);
                expect(config.indexOf("name = John Doe")).not.toBe(-1);
            })
            .then(done, done);
        });

        it("creates git config with login and email", function(done) {
            spyOn(projectWorkspace, "_npmInstall");

            githubUser.email = "jdoe@declarativ.com";

            return _git.init(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace._setupWorkspaceRepository();
            })
            .then(function() {
                return fs.read(fs.join(projectWorkspace._workspacePath, ".git", "config"));
            })
            .then(function(config) {
                expect(config.indexOf('[user]')).not.toBe(-1);
                expect(config.indexOf("email = jdoe@declarativ.com")).not.toBe(-1);
            })
            .then(done, done);
        });

        it("install node modules", function(done) {
            var spy = spyOn(projectWorkspace, "_npmInstall");

            return _git.init(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace._setupWorkspaceRepository();
            }).then(function() {
                expect(spy).toHaveBeenCalled();
            })
            .then(done, done);
        });
    });

    describe("exists workspace", function() {
        it("should be false if .git does not exist", function(done) {
            return fs.makeTree(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace.existsWorkspace();
            })
            .then(function(existsWorkspace) {
                expect(existsWorkspace).toBe(false);
            }).then(done, done);
        });

        it("should be true if .git does exist", function(done) {
            return fs.makeTree(fs.join(projectWorkspace._workspacePath, ".git"))
            .then(function() {
                return projectWorkspace.existsWorkspace();
            })
            .then(function(existsWorkspace) {
                expect(existsWorkspace).toBe(true);
            }).then(done, done);
        });
    });

    describe("initialization", function() {
        it("should initialize by creating an empty project", function(done) {
            var spy = spyOn(projectWorkspace, "initializeWithEmptyProject");

            spyOn(projectWorkspace._repoService, "isProjectEmpty")
            .andCallFake(function() {
                return Q.resolve(true);
            });

            spyOn(projectWorkspace._repoService, "checkoutShadowBranch")
            .andCallFake(function() {
                return Q.resolve(true);
            });

            return projectWorkspace.initializeWorkspace()
            .then(function() {
                expect(spy).toHaveBeenCalled();
            }).then(done, done);
        });

        it("should initialize by cloning a repository", function(done) {
            var spy = spyOn(projectWorkspace, "initializeWithRepository");

            spyOn(projectWorkspace._repoService, "isProjectEmpty")
            .andCallFake(function() {
                return Q.resolve(false);
            });

            spyOn(projectWorkspace._repoService, "checkoutShadowBranch")
            .andCallFake(function() {
                return Q.resolve(true);
            });

            return projectWorkspace.initializeWorkspace()
            .then(function(info) {
                expect(spy).toHaveBeenCalled();
            }).then(done, done);
        });
    });

    describe("file operations", function() {
        it("should save a file", function(done) {
            return createWorkspace(tmpPath, owner, repo)
            .then(function() {
                return projectWorkspace.saveFile("index.js", "content");
            })
            .then(function() {
                return fs.read(fs.join(projectWorkspace._workspacePath, "index.js"));
            })
            .then(function(data) {
                expect(data.toString()).toBe("content");
            }).then(done, done);
        });
    });

    if (process.env.runSlowSpecs) {
        describe("montage operations", function() {
            it("should create a component on disk", function(done) {
                // Avoid flushing the workspace for this test.
                spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createComponent("my-component");
                })
                .then(function() {
                    return fs.isDirectory(fs.join(projectWorkspace._workspacePath, "ui", "my-component.reel"));
                })
                .then(function(isDirectory) {
                    expect(isDirectory).toBe(true);
                }).then(done, done);
            });

            it("should create a component on disk with a given destination", function(done) {
                // Avoid flushing the workspace for this test.
                spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createComponent("my-component", "model");
                })
                .then(function() {
                    return fs.isDirectory(fs.join(projectWorkspace._workspacePath, "model/", "my-component.reel"));
                })
                .then(function(isDirectory) {
                    expect(isDirectory).toBe(true);
                }).then(done, done);
            });

            it("should flush the created component to remote git", function(done) {
                var spy = spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createComponent("my-component");
                })
                .then(function(data) {
                    expect(spy).toHaveBeenCalled();
                }).then(done, done);
            });

            it("should create a module on disk", function(done) {
                // Avoid flushing the workspace for this test.
                spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createModule("my-module");
                })
                .then(function() {
                    return fs.isFile(fs.join(projectWorkspace._workspacePath, "my-module.js"));
                })
                .then(function(isFile) {
                    expect(isFile).toBe(true);
                }).then(done, done);
            });

            it("should create a module on disk with given destination", function(done) {
                // Avoid flushing the workspace for this test.
                spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createModule("my-module", undefined, undefined, "model");
                })
                .then(function() {
                    return fs.isFile(fs.join(projectWorkspace._workspacePath, "model" , "my-module.js"));
                })
                .then(function(isFile) {
                    expect(isFile).toBe(true);
                }).then(done, done);
            });

            it("should flush the created module to remote git", function(done) {
                var spy = spyOn(projectWorkspace, "flushWorkspace");

                return createWorkspace(tmpPath, owner, repo)
                .then(function() {
                    return projectWorkspace.createModule("my-module");
                })
                .then(function(data) {
                    expect(spy).toHaveBeenCalled();
                }).then(done, done);
            });
        });
    }
});
