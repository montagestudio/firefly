var fs = require("q-io/fs");
var Git = require("../git");

describe("Git", function () {
    var git;
    beforeEach(function () {
        var accessToken = "xxx";
        git = new Git(fs, accessToken);
    });

    describe("init", function () {
        it("works", function (done) {
            var tmp = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
            git.init(tmp)
            .then(function () {
                return git.isCloned(tmp);
            })
            .then(function (isCloned) {
                expect(isCloned).toBe(true);
            })
            .finally(function () {
                return fs.removeTree(tmp);
            })
            .then(done, done);
        });
    });

    describe("clone", function () {
        it("works", function (done) {
            var tmp = "/tmp/git-clone-spec-" + Date.now() + Math.floor(Math.random() * 999999);
            git.clone("https://github.com/montagejs/mousse.git", tmp)
            .then(function () {
                return git.isCloned(tmp);
            })
            .then(function (isCloned) {
                expect(isCloned).toBe(true);
            })
            .finally(function () {
                return fs.removeTree(tmp);
            })
            .then(done, done);
        });
    });
});
