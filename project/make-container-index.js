var fs = require("fs");
var Map = require("collections/map");

module.exports = makeContainerIndex;
function makeContainerIndex(filename) {
    var containers = new Map();

    // Repopulate the map with the saved files
    if (filename) {
        var entries;
        try {
            entries = JSON.parse(fs.readFileSync(filename, {encoding: "utf8"}));
        } catch (e) {}
        if (entries) {
            entries.map(function (entry) { containers.set(entry[0], entry[1]); });
        }

        containers.addMapChangeListener(function () {
            var entries = containers.entries();
            fs.writeFileSync(filename, JSON.stringify(entries));
        });
    }

    containers.forUsername = function (username) {
        username = username.toLowerCase();

        // At the time of writing Map.prototype.filter is broken
        // When collections is fixed, replace with:
        // return this.filter(function (value, key) {
        //     return key.username === username;
        // });
        var result = this.constructClone();
        this.reduce(function (undefined, value, key) {
            if (key.username === username) {
                result.set(key, value);
            }
        }, undefined);

        return result;
    };

    return containers;
}