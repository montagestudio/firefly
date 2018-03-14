var log = require("./common/logging").from(__filename);
var PATH = require("path");
var FS = require("q-io/fs");
var exec = require("./exec");

module.exports = Minit;
function Minit(path) {
    this._path = path;
}

Minit.prototype.createApp = function(path, name) {
    log(path + "$ create:digit -n " + name);
    // Minit creates the app in the directory you give it, base on the name you
    // give it, so we just create it in /tmp and move it where it's needed.
    var dest = "_" + new Date().getTime() + Math.floor(Math.random() * 999999),
        destFullPath = PATH.join("/tmp", dest);
    return exec(this._path, ["create:digit", "-n", name, "-d", dest], "/tmp")
    .then(function() {
        // As minit might have altered the name we provided, we need to list the
        // destination directory to find out the new name
        return FS.list(destFullPath);
    })
    .then(function (paths) {
        if (paths.length !== 1) {
            throw new Error("unexpected minit output");
        }
        var source = PATH.join(destFullPath, paths[0]);
        log("moving", source, "to", path);
        return FS.move(source, path);
    }).finally(function() {
        return FS.removeDirectory(destFullPath);
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
