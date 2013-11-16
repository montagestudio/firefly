var fs = require("q-io/fs");
var Git = require("../git");

describe("Git", function () {
    var git, tmpPath;
    beforeEach(function () {
        var accessToken = "xxx";
        git = new Git(fs, accessToken);
        tmpPath = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
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

    describe("clone", function () {
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
});
