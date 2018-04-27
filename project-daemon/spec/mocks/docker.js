var Q = require("q");
var uuid = require("uuid");

module.exports = MockDocker;
function MockDocker() {
    this.modem = {
        containers: []
    };
}

function Container(modem, id) {
    this.modem = modem;
    this.id = id;
}

Container.prototype.inspect = function () {
    var self = this;
    var info = this.modem.containers.filter(function (container) {
        return container.ID === self.id;
    })[0];
    return info ? Q(info) : Q.reject(new Error("Container does not exist"));
};

Container.prototype.start = function () {
    var self = this;
    var info = this.modem.containers.filter(function (container) {
        return container.ID === self.id;
    })[0];
    if (info.PortBindings) {
        info.NetworkSettings = info.NetworkSettings || {Ports: []};
        info.NetworkSettings.Ports[Object.keys(info.PortBindings)[0]] = [{ HostPort: "1234" }];
    }
    return Q();
};

Container.prototype.stop = function () {
    return Q();
};

Container.prototype.remove = function () {
    var self = this;
    var info = this.modem.containers.filter(function (container) {
        return container.Id === self.id;
    })[0];
    if (info) {
        this.modem.containers.splice(this.modem.containers.indexOf(info));
        return Q();
    } else {
        return Q.reject(new Error("Container does not exist"));
    }
};

MockDocker.prototype.Container = Container;

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

    return Q(new Container(this.modem, id));
};
