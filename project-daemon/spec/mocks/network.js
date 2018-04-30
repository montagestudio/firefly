var Q = require("q");

function Network(modem, id) {
    this.modem = modem;
    this.id = id;
}
module.exports = Network;

Network.prototype.connect = function () {
    return Q();
};
