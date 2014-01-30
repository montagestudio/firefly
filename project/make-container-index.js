var fs = require("fs");
var Map = require("collections/map");

module.exports = makeContainerIndex;
function makeContainerIndex(filename) {
    var containers = new Map(undefined, equals, hash);

    // Repopulate the map with the saved files
    if (filename) {
        var entries;
        try {
            entries = JSON.parse(fs.readFileSync(filename, {encoding: "utf8"}));
        } catch (e) {}
        if (entries) {
            entries.map(function (entry) { containers.set(entry[0], entry[1]); });
        }
    }

    // Override `set` to persist the data
    var originalSet = containers.set;
    containers.set = function (key, value) {
        originalSet.call(this, key, value);

        if (filename) {
            var entries = this.entries();
            fs.writeFileSync(filename, JSON.stringify(entries));
        }
    };

    return containers;
}

function equals(a, b) {
    return (
        a.user === b.user &&
        a.owner === b.owner &&
        a.repo === b.repo
    );
}

function hash(value) {
    return [value.user, value.owner, value.repo].join("/");
}
