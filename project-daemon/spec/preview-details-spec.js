var PreviewDetails = require("../preview-details");
var Set = require("collections/set");

describe("PreviewDetails", function () {
    var details;
    beforeEach(function () {
        details = new PreviewDetails("username", "owner", "repo");
    });

    it("constructs a details object", function () {
        expect(details.username).toEqual("username");
        expect(details.owner).toEqual("owner");
        expect(details.repo).toEqual("repo");
    });

    it("lower-cases the strings", function () {
        var details = new PreviewDetails("USernamE", "OwNeR", "REPO");

        expect(details.username).toEqual("username");
        expect(details.owner).toEqual("owner");
        expect(details.repo).toEqual("repo");
    });

    describe("equals", function () {
        it("is true for the same details", function () {
            var other = new PreviewDetails("username", "owner", "repo");
            expect(details.equals(other)).toBe(true);
        });

        it("is false for different details", function () {
            var other = new PreviewDetails("different", "owner", "repo");
            expect(details.equals(other)).toBe(false);
        });
    });

    describe("hash", function () {
        it("hashes the same details to the same hash", function () {
            var other = new PreviewDetails("username", "owner", "repo");
            expect(details.hash()).toEqual(other.hash());
        });

        it("is false for different details", function () {
            var other = new PreviewDetails("different", "owner", "repo");
            expect(details.hash()).not.toEqual(other.hash());
        });
    });

    it("uniques itself in a set", function () {
        var set = Set();

        set.add(new PreviewDetails("one", "one", "one"));
        set.add(new PreviewDetails("one", "one", "one"));
        set.add(new PreviewDetails("two", "two", "two"));

        expect(set.length).toEqual(2);
        expect(set.toArray()[0].username).toEqual("one");
        expect(set.toArray()[1].username).toEqual("two");
    });

    describe("path", function () {
        it("generates a path", function () {
            expect(details.toPath()).toEqual("/username/owner/repo/");
        });

        it("generates a url", function () {
            expect(details.toUrl("http://base/", "foo/bar")).toEqual("http://base/username/owner/repo/foo/bar");
        });

        it("can be created from a url", function () {
            var other = PreviewDetails.fromPath("/username/owner/repo");
            expect(other).toEqual(details);
        });
    });
});
