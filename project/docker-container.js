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
    return Q.npost(this.container, "start", arguments);
};

Container.prototype.inspect = function () {
    return Q.npost(this.container, "inspect", arguments);
};

Container.prototype.stop = function () {
    return Q.npost(this.container, "stop", arguments);
};

Container.prototype.remove = function () {
    return Q.npost(this.container, "remove", arguments);
};
