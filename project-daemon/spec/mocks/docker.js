var Q = require("q");
var uuid = require("uuid");

module.exports = MockDocker;
function MockDocker() {}

MockDocker.prototype.createService = function () {
    return Q({
        id: uuid.v4(),
        remove: function () {
            return Q.resolve();
        }
    });
};

MockDocker.prototype.listServices = function () {
    return Q([]);
};
