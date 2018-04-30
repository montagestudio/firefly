var Q = require("q");
var uuid = require("uuid");
var Container = require("./container");
var Network = require("./network");

module.exports = MockDocker;
function MockDocker() {
    this.modem = {
        containers: [],
        networks: [{ id: "firefly_projects" }]
    };
}

MockDocker.prototype.Container = Container;

MockDocker.prototype.getContainer = function (id) {
    return new Container(this.modem, id);
};

MockDocker.prototype.listContainers = function () {
    return Q(this.modem.containers);
};

MockDocker.prototype.createContainer = function (opts) {
    var id = uuid.v4();
    var container = {
        ID: id,
        Names: opts.Name,
        State: {}
    };
    Object.assign(container, opts);
    this.modem.containers.push(container);

    return Q(this.getContainer(id));
};

MockDocker.prototype.getNetwork = function (id) {
    return new Network(this.modem, id);
};
