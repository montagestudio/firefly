var log = require("../logging").from(__filename);
var FS = require("q-io/fs");
var exec = require("./exec");

module.exports = Minit;
function Minit(path) {
    this._path = path;
}

Minit.prototype.createApp = function(path, name) {
    log(path + "$ create:digit -n " + name);
    // Minit creates the app in the directory you give it, with the name you
    // give it, so we just create it in /tmp and move it where it's needed.
    return exec(this._path, ["create:digit", "-n", name], "/tmp")
    .then(function () {
        log("moving", FS.join("/tmp", name), "to", path);
        return FS.move(FS.join("/tmp", name), path);
    });
};

Minit.prototype.createComponent = function(path, name, destination) {
    var args = ["create:component", "-n", name];
    if (destination) {
        args.push("-d");
        args.push(destination);
    }
    log(path + "$ " + args);
    return exec(this._path, args, path);
};

Minit.prototype.createModule = function(path, name, extendsModuleId, extendsName, destination) {
    var args = ["create:module", "-n", name];
    if (extendsModuleId && extendsName) {
        args.push("--extends-module-id", extendsModuleId);
        args.push("--extends-name", extendsName);
    }
    if (destination) {
        args.push("-d");
        args.push(destination);
    }
    log(path + "$ " + args);
    return exec(this._path, args, path);
};
