var Q = require("q");
var fs = require("q-io/fs");
var exec = require('child_process').exec;
var MockGithubApi = require("../mocks/github-api");
var ProjectWorkspace = require("../../project/project-workspace");

function createWorkspace(tmpPath, owner, repo) {
    return fs.makeTree(fs.join(tmpPath, owner, repo));
}

describe("ProjectWorkspace", function () {
    var projectWorkspace, tmpPath, owner, repo, session, githubUser,
        minitPath = fs.join(__dirname, "..", "..", "node_modules", "minit", "minit");

    beforeEach(function () {
        githubUser = {login: "jdoe"};
        tmpPath = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
        session = {
            username: "jdoe",
            githubUser: Q(githubUser)
        };
        owner = "owner";
        repo = "repo";
        var workspacePath = fs.join(tmpPath, owner, repo);
        projectWorkspace = new ProjectWorkspace(session, workspacePath, owner, repo, minitPath);
        projectWorkspace.__githubApi = new MockGithubApi();
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
        it("creates git config with login and default email", function(done) {
            spyOn(projectWorkspace, "_npmInstall");

            return projectWorkspace._git.init(projectWorkspace._workspacePath)
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

            return projectWorkspace._git.init(projectWorkspace._workspacePath)
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

            return projectWorkspace._git.init(projectWorkspace._workspacePath)
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

            return projectWorkspace._git.init(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace._setupWorkspaceRepository();
            }).then(function() {
                expect(spy).toHaveBeenCalled();
            })
            .then(done, done);
        });
    });

    describe("info", function() {
        it("should have the git url", function(done) {
            return projectWorkspace.getInfo()
            .then(function(info) {
                expect(info.gitUrl).toBe("https://github.com/" + owner + "/" + repo + ".git");
            }).then(done, done);
        });

        it("should have the default branch", function(done) {
            return projectWorkspace.getInfo()
            .then(function(info) {
                expect(info.gitBranch).toBe("master");
            }).then(done, done);
        });
    });

    describe("exists workspace", function() {
        it("should exist", function(done) {
            return fs.makeTree(projectWorkspace._workspacePath)
            .then(function() {
                return projectWorkspace.existsWorkspace();
            })
            .then(function(existsWorkspace) {
                expect(existsWorkspace).toBe(true);
            }).then(done, done);
        });

        it("should not exist", function(done) {
            return projectWorkspace.existsWorkspace()
            .then(function(existsWorkspace) {
                expect(existsWorkspace).toBe(false);
            }).then(done, done);
        });
    });

    describe("initialization", function() {
        it("should initialize by creating an empty project", function(done) {
            var spy = spyOn(projectWorkspace, "initializeWithEmptyProject");

            spyOn(projectWorkspace.__githubApi, "isRepositoryEmpty")
            .andCallFake(function() {
                return Q.resolve(true);
            });

            return projectWorkspace.initializeWorkspace()
            .then(function(info) {
                expect(spy).toHaveBeenCalled();
            }).then(done, done);
        });

        it("should initialize by cloning a repository", function(done) {
            var spy = spyOn(projectWorkspace, "initializeWithRepository");

            spyOn(projectWorkspace.__githubApi, "isRepositoryEmpty")
            .andCallFake(function() {
                return Q.resolve(false);
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

        it("should flush the created component to remote git", function(done) {
            var spy = spyOn(projectWorkspace, "flushWorkspace");

            return createWorkspace(tmpPath, owner, repo)
            .then(function() {
                return projectWorkspace.createModule("my-component");
            })
            .then(function(data) {
                expect(spy).toHaveBeenCalled();
            }).then(done, done);
        });
    });

    describe("git operations", function() {
        it("should flush the workspace", function(done) {
            var callOrder = [];

            spyOn(projectWorkspace, "_commitWorkspace")
            .andCallFake(function() {
                callOrder.push("_commitWorkspace");
                return Q.resolve();
            });

            spyOn(projectWorkspace, "_pushWorkspace")
            .andCallFake(function() {
                callOrder.push("_pushWorkspace");
                return Q.resolve();
            });

            return projectWorkspace.flushWorkspace()
            .then(function() {
                expect(callOrder).toEqual(["_commitWorkspace", "_pushWorkspace"]);
            }).then(done, done);
        });
    });
});
