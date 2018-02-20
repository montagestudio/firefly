var Dockerode = require("dockerode");

module.exports = Docker;
function Docker() {
    var dockerode = Object.create(Dockerode.prototype);
    dockerode = Dockerode.apply(dockerode, arguments) || dockerode;
    this.dockerode = dockerode;
    this.modem = this.dockerode.modem;
}

Docker.prototype.createService = function (opts) {
    return this.dockerode.createService(opts)
    .catch(function (error) {
        throw new Error("Could not create service because " + error.message);
    });
};

Docker.prototype.listImages = function (opts) {
    return this.dockerode.listImages(opts)
    .catch(function (error) {
        throw new Error("Could not list images because " + error.message);
    });
};
