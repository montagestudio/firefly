var Dockerode = require("dockerode");
var exec = require("./common/exec");

function Stack(id) {
    this.id = id;
}

Stack.prototype.exists = function () {
    var self = this;
    return exec("docker", ["stack", "ps", this.id])
        .then(function () {
            return null;
        }, function () {
            throw new Error("Stack " + self.id + " does not exist.");
        });
};

Stack.prototype.remove = function () {
    var self = this;
    return this.exists()
        .then(function () {
            return exec("docker", ["stack", "rm", self.id]);
        });
};

Dockerode.prototype.getStack = function (id) {
    return new Stack(id);
};

Dockerode.prototype.listStacks = function () {
    return exec("docker", ["stack", "ls"], undefined, true)
        .then(function (stdout) {
            var lines = stdout.split("\n").slice(1);
            return lines.map(function (line) {
                var stackName = line.split(" ")[0];
                return new Stack(stackName);
            });
        });
};

Dockerode.prototype.deployStack = function (name, stackFilePath) {
    return exec("docker", ["stack", "deploy", "-c", stackFilePath, name]);
};
