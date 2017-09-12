var Promise = require("bluebird");
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
    var createContainer = Promise.promisify(this.dockerode.createContainer, { context: this.dockerode });
    return createContainer.apply(this.dockerode, arguments)
    .then(function (container) {
        return new self.Container(container);
    })
    .catch(function (error) {
        throw new Error("Could not create container because " + error.message);
    });
};

Docker.prototype.listImages = function () {
    var listImages = Promise.promisify(this.dockerode.listImages, { context: this.dockerode });
    return listImages.apply(this.dockerode, arguments)
    .catch(function (error) {
        throw new Error("Could not list images because " + error.message);
    });
};

Docker.prototype.Container = Container;
