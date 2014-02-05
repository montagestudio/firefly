var fs = require("q-io/fs");
var exec = require('child_process').exec;
var Git = require("../../project/git");

describe("Git", function () {
    var git, tmpPath;
    beforeEach(function () {
        var accessToken = "xxx";
        git = new Git(fs, accessToken);
        tmpPath = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
    });
    afterEach(function() {
        exec("cd /tmp; rm -Rf git-clone-spec-*");
    });

    describe("init", function () {
        it("works", function (done) {
            git.init(tmpPath)
            .then(function () {
                return git.isCloned(tmpPath);
            })
            .then(function (isCloned) {
                expect(isCloned).toBe(true);
            })
            .finally(function () {
                return fs.removeTree(tmpPath);
            })
            .then(done, done);
        });
    });

    describe("addRemote", function () {
        it("works", function (done) {
            git.init(tmpPath)
            .then(function () {
                return git.addRemote(tmpPath, "https://github.com/montagejs/mousse.git");
            })
            .then(function () {
                return fs.read(fs.join(tmpPath, ".git", "config"));
            })
            .then(function (config) {
                expect(config.indexOf('[remote "origin"]')).not.toBe(-1);
                expect(config.indexOf("url = https://github.com/montagejs/mousse.git")).not.toBe(-1);
            })
            .then(done, done);
        });
    });

    describe("fetch and branch", function () {
        it("works", function (done) {
            git.init(tmpPath)
            .then(function () {
                return git.addRemote(tmpPath, "https://github.com/montagejs/mousse.git");
            })
            .then(function () {
                return git.fetch(tmpPath);

            })
            .then(function () {
                return git.branch(tmpPath, "-a");

            })
            .then(function(branches) {
                expect(branches.indexOf("remotes/origin/master")).not.toBe(-1);
            })
            .then(done, done);
        });
    });

    describe("add", function () {
        it("works", function (done) {
            git.init(tmpPath)
            .then(function () {
                fs.write(fs.join(tmpPath, "test.txt"), "pass");
            })
            .then(function () {
                return git.add(tmpPath, ".");
            })
            .then(function () {
                return fs.exists(fs.join(tmpPath, ".git", "index"));
            })
            .then(function (indexExists) {
                expect(indexExists).toBe(true);
            })
            .then(done, done);
        });
    });

    describe("commit", function () {
        it("works", function (done) {
            git.init(tmpPath)
            .then(function () {
                fs.write(fs.join(tmpPath, "test.txt"), "pass");
            })
            .then(function () {
                return git.add(tmpPath, ".");
            })
            .then(function () {
                return git.commit(tmpPath, "testing");
            })
            .then(function () {
                return fs.exists(fs.join(tmpPath, ".git", "refs", "heads", "master"));
            })
            .then(function (masterExists) {
                expect(masterExists).toBe(true);
            })
            .then(done, done);
        });
    });

    // Disabled because timeouts keep affecting the test run
    xdescribe("clone", function () {
        it("works", function (done) {
            git.clone("https://github.com/montagejs/mousse.git", tmpPath)
            .then(function () {
                return git.isCloned(tmpPath);
            })
            .then(function (isCloned) {
                expect(isCloned).toBe(true);
            })
            .finally(function () {
                return fs.removeTree(tmpPath);
            })
            .then(done, done);
        });
    });

    describe("config", function () {
        it("configures name", function (done) {
            git.init(tmpPath)
            .then(function () {
                return git.config(tmpPath, "user.name", "John Doe");
            })
            .then(function () {
                return fs.read(fs.join(tmpPath, ".git", "config"));
            })
            .then(function (config) {
                expect(config.indexOf('[user]')).not.toBe(-1);
                expect(config.indexOf("name = John Doe")).not.toBe(-1);
            })
            .then(done, done);
        });

        it("configures email", function (done) {
            git.init(tmpPath)
            .then(function () {
                return git.config(tmpPath, "user.email", "noreply@declarativ.com");
            })
            .then(function () {
                return fs.read(fs.join(tmpPath, ".git", "config"));
            })
            .then(function (config) {
                expect(config.indexOf('[user]')).not.toBe(-1);
                expect(config.indexOf("email = noreply@declarativ.com")).not.toBe(-1);
            })
            .then(done, done);
        });
    });
});
