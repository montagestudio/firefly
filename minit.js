var log = require("logging").from(__filename);
var exec = require("./exec");

module.exports = Minit;
function Minit(path) {
    this._path = path;
}

Minit.prototype.createApp = function(path, name) {
    log(path + "$ create:app -n " + name);
    return exec(this._path, ["create:app", "-n", name], path);
};

Minit.prototype.createComponent = function(path, name) {
    log(path + "$ create:component -n " + name);
    return exec(this._path, ["create:component", "-n", name], path);
};

Minit.prototype.createModule = function(path, name, extendsModuleId, extendsName) {
    var args = ["create:module", "-n", name];
    if (extendsModuleId && extendsName) {
        args.push("--extends-module-id", extendsModuleId);
        args.push("--extends-name", extendsName);
    }
    log(path + "$ " + args);
    return exec(this._path, args, path);
};