const log = require("logging").from(__filename);
const Connection = require("q-connection");
// preload mop as this is currently taking ~3s when running on vbox.
process.nextTick(() => require("mop"));

const connectionObject = {
    optimize(applicationPath, options) {
        log("optimize");
        return require("mop")(applicationPath, options);
    }
};

Connection(process, connectionObject);
