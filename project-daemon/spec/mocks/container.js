var Q = require("q");

function Container(modem, id) {
    this.modem = modem;
    this.id = id;
}
module.exports = Container;

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