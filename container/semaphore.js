var Queue = require("../promise-queue");

exports.Semaphore = Semaphore;

function Semaphore() {
    this._semaphore = new Queue();
    this._semaphore.put(); // once for one job at a time
}

/**
 * Wraps any function with exclusive to make sure it wont execute before all
 * pending exclusive methods are done.
 */
Semaphore.prototype.exclusive = function(method) {
    var semaphore = this._semaphore;

    return function wrapped() {
        var self = this, args = Array.prototype.slice.call(arguments);

        return semaphore.get()
        .then(function () {
            return method.apply(self, args);
        }).finally(function() {
            semaphore.put();
        });
    };
};