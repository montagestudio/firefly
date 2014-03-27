var logging = require("../logging");

describe("logging", function () {
    var from, log, output;
    beforeEach(function () {
        output = [];
        from = logging.makeFrom({
            out: function (message) {
                output.push(message);
            }
        });
        log = from("test");
    });

    it("scrubs access codes", function () {
        log("git", "clone", "https://e457a952a1dd76abcf57fa64959f7c3588fbe7cd:x-oauth-basic@github.com/example/example.git");
        expect(output.length).toEqual(1);
        expect(output[0]).toContain("https://SCRUBBED:x-oauth-basic@github.com/example/example.git");
    });
});
