var makeContainerIndex = require("../../project/make-container-index");

describe("makeContainerIndex", function () {
    var containerIndex;
    beforeEach(function () {
        containerIndex = makeContainerIndex();
    });

    describe("forUsername", function () {
        it("returns only the containers for that username", function () {
            containerIndex.set({user: "a", owner: "b", repo: "c"}, "aaa");
            containerIndex.set({user: "z", owner: "d", repo: "e"}, "bbb");
            containerIndex.set({user: "a", owner: "f", repo: "g"}, "ccc");
            containerIndex.set({user: "n", owner: "h", repo: "i"}, "ddd");

            var containers = containerIndex.forUsername("a");
            expect(containers.length).toEqual(2);
            expect(containers.keys()).toEqual([{user: "a", owner: "b", repo: "c"}, {user: "a", owner: "f", repo: "g"}]);
        });
    });

});
