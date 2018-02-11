var makeContainerIndex = require("../../project-daemon/make-container-index");

describe("makeContainerIndex", function () {
    var containerIndex;
    beforeEach(function () {
        containerIndex = makeContainerIndex();
    });

    describe("forUsername", function () {
        it("returns only the containers for that username", function () {
            containerIndex.set({username: "a", owner: "b", repo: "c"}, "aaa");
            containerIndex.set({username: "z", owner: "d", repo: "e"}, "bbb");
            containerIndex.set({username: "a", owner: "f", repo: "g"}, "ccc");
            containerIndex.set({username: "n", owner: "h", repo: "i"}, "ddd");

            var containers = containerIndex.forUsername("a");
            expect(containers.length).toEqual(2);
            expect(containers.keys()).toEqual([{username: "a", owner: "b", repo: "c"}, {username: "a", owner: "f", repo: "g"}]);
        });
    });

});
