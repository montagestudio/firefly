var Q = require("q");
var DockerodeContainer = require("dockerode/lib/container");

module.exports = Container;
function Container(modem, id) {
    var container;
    if (modem instanceof DockerodeContainer) {
        container = modem;
    } else {
        container = new DockerodeContainer(modem, id);
    }

    this.id = container.id;
    this.container = container;
}

Container.prototype.start = function () {
    var self = this;
    return Q.npost(this.container, "start", arguments)
    .catch(function (error) {
        throw new Error("Could not start container " + self.id + " because " + error.message);
    });
};

Container.prototype.inspect = function () {
    var self = this;
    return Q.npost(this.container, "inspect", arguments)
    .catch(function (error) {
        throw new Error("Could not inspect container " + self.id + " because " + error.message);
    });
};

Container.prototype.stop = function () {
    var self = this;
    return Q.npost(this.container, "stop", arguments)
    .catch(function (error) {
        throw new Error("Could not stop container " + self.id + " because " + error.message);
    });
};

Container.prototype.remove = function () {
    var self = this;
    return Q.npost(this.container, "remove", arguments)
    .catch(function (error) {
        throw new Error("Could not remove container " + self.id + " because " + error.message);
    });
};
