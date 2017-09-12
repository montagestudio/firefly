var Promise = require("bluebird");
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
    var start = Promise.promisify(this.container.start, { context: this.container });
    return start.apply(this.container, arguments)
    .catch(function (error) {
        throw new Error("Could not start container " + self.id + " because " + error.message);
    });
};

Container.prototype.inspect = function () {
    var self = this;
    var inspect = Promise.promisify(this.container.inspect, { context: this.container });
    return inspect.apply(this.container, arguments)
    .catch(function (error) {
        throw new Error("Could not inspect container " + self.id + " because " + error.message);
    });
};

Container.prototype.stop = function () {
    var self = this;
    var stop = Promise.promisify(this.container.stop, { context: this.container });
    return stop.apply(this.container, arguments)
    .catch(function (error) {
        throw new Error("Could not stop container " + self.id + " because " + error.message);
    });
};

Container.prototype.remove = function () {
    var self = this;
    var remove = Promise.promisify(this.container.remove, { context: this.container });
    return remove.apply(this.container, arguments)
    .catch(function (error) {
        throw new Error("Could not remove container " + self.id + " because " + error.message);
    });
};
