var Q = require("q");
var Dockerode = require("dockerode");

var Container = require("./docker-container");

module.exports = Docker;
function Docker() {
    var dockerode = Object.create(Dockerode.prototype);
    dockerode = Dockerode.apply(dockerode, arguments) || dockerode;
    this.dockerode = dockerode;
    this.modem = this.dockerode.modem;
}

Docker.prototype.createContainer = function () {
    var self = this;
    return Q.npost(this.dockerode, "createContainer", arguments)
    .then(function (container) {
        return new self.Container(container);
    });
};

Docker.prototype.listImages = function () {
    return Q.npost(this.dockerode, "listImages", arguments);
};

Docker.prototype.Container = Container;
