var Q = require("q");
var uuid = require("uuid");

var Container = require("./docker-container");

module.exports = MockDocker;
function MockDocker() {}

MockDocker.prototype.createContainer = function () {
    return Q(new Container(null, uuid.v4()));
};

MockDocker.prototype.createService = function () {
    return Q({
        id: uuid.v4(),
        remove: function () {
            return Q.resolve();
        }
    });
};

MockDocker.prototype.Container = Container;
