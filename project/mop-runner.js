/* global process */
var log = require("./common/logging").from(__filename);
var Connection = require("q-connection");
process.nextTick(function() {
    // preload mop as this is currently taking ~3s when running on vbox.
    require("mop");
});

var connectionObject = {
    optimize: function(applicationPath, options) {
        log("optimize");
        return require("mop")(applicationPath, options);
    }
};

Connection(process, connectionObject);