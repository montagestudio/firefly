const ProjectInfo = require("../project-info");
const Set = require("collections/set");

describe("ProjectInfo", () => {
    var details;
    beforeEach(() => {
        details = new ProjectInfo("username", "owner", "repo");
    });

    it("constructs a details object", () => {
        expect(details.username).toEqual("username");
        expect(details.owner).toEqual("owner");
        expect(details.repo).toEqual("repo");
    });

    it("lower-cases the strings", () => {
        const details = new ProjectInfo("USernamE", "OwNeR", "REPO");
        expect(details.username).toEqual("username");
        expect(details.owner).toEqual("owner");
        expect(details.repo).toEqual("repo");
    });

    describe("equals", () => {
        it("is true for the same details", () => {
            const other = new ProjectInfo("username", "owner", "repo");
            expect(details.equals(other)).toBe(true);
        });

        it("is false for different details", () => {
            const other = new ProjectInfo("different", "owner", "repo");
            expect(details.equals(other)).toBe(false);
        });
    });

    describe("hash", () => {
        it("hashes the same details to the same hash", () => {
            const other = new ProjectInfo("username", "owner", "repo");
            expect(details.hash()).toEqual(other.hash());
        });

        it("is false for different details", () => {
            const other = new ProjectInfo("different", "owner", "repo");
            expect(details.hash()).not.toEqual(other.hash());
        });
    });

    it("uniques itself in a set", () => {
        const set = Set();

        set.add(new ProjectInfo("one", "one", "one"));
        set.add(new ProjectInfo("one", "one", "one"));
        set.add(new ProjectInfo("two", "two", "two"));

        expect(set.length).toEqual(2);
        expect(set.toArray()[0].username).toEqual("one");
        expect(set.toArray()[1].username).toEqual("two");
    });

    describe("path", () => {
        it("generates a path", () => {
            expect(details.toPath()).toEqual("/username/owner/repo/");
        });

        it("generates a url", () => {
            expect(details.toUrl("http://base/", "foo/bar")).toEqual("http://base/username/owner/repo/foo/bar");
        });

        it("can be created from a url", () => {
            const other = ProjectInfo.fromPath("/username/owner/repo");
            expect(other).toEqual(details);
        });
    });
});
