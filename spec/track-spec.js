var track = require("../track");

describe("tracking", function () {

    describe("scrubError", function () {
        it("returns the same error when no replacement is needed", function () {
            var message = "Plain error message x-oauth-basic";
            var error = new Error(message);
            var scrubbedError = track.scrubError(error);

            expect(scrubbedError).toBe(error);
            expect(scrubbedError.message).toEqual(message);
        });

        it("removes access tokens from error messages", function () {
            var message = "git push https://f3d9d93456fbcaa27146f9ba346a992a3aaaaaaa:x-oauth-basic@github.com/example/example failed";
            var error = new Error(message);
            var scrubbedError = track.scrubError(error);

            expect(scrubbedError).not.toBe(error);
            expect(error.message).toEqual(message);
            expect(scrubbedError.message).toEqual("git push https://SCRUBBED:x-oauth-basic@github.com/example/example failed");
        });
    });

});
