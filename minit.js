var log = require("logging").from(__filename);
var exec = require("./exec");

module.exports = Minit;
function Minit(path) {
    this._path = path;
}

Minit.prototype.createApp = function(name, path) {
    log(path + "$ create:app -n " + name);
    return exec(this._path, ["create:app", "-n", name], path);
};

Minit.prototype.createComponent = function(name, path) {
    log(path + "$ create:component -n " + name);
    return exec(this._path, ["create:component", "-n", name], path);
};