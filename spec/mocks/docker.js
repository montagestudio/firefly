var Promise = require("bluebird");
var uuid = require("uuid");

var Container = require("./docker-container");

module.exports = MockDocker;
function MockDocker() {}

MockDocker.prototype.createContainer = function () {
    return Promise.resolve(new Container(null, uuid.v4()));
};

MockDocker.prototype.Container = Container;
