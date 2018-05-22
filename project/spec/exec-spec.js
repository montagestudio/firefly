var exec = require("../exec");

describe("exec", function () {
    it("doesn't wait on stdout", function (done) {
        exec("node", ["./fixtures/stdout-script.js"], __dirname)
        .timeout(1000)
        .then(done, done);
    });

    it("rejects if the command doesn't exist", function (done) {
        exec("./does-not-exist", [], __dirname)
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            done();
        });
    });

    it("rejects if the command exits with a non-zero code", function (done) {
        exec("node", ["./fixtures/non-zero-exit.js"], __dirname)
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message.indexOf("exited with code")).not.toEqual(-1);
            done();
        });
    });

    it("returns some output", function (done) {
        var text = "Did somebody break the code?";
        exec("echo", [text], __dirname, true)
        .then(function (output) {
            // remove the trailing newline
            output = output.substring(0, output.length - 1);
            expect(output).toEqual(text);
        })
        .then(done, done);
    });
});
