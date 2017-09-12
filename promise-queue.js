var Promise = require("bluebird");

function defer() {
    var resolve, reject;
    var promise = new Promise(function () {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
}

/**
 * A promise-based FIFO queue that processes on promise at a time. Derived from
 * the q.js queue.
 * 
 * @class Queue
 */
function Queue() {
    this._ends = defer();
    this._closed = defer();
    this.closed = this._closed.promise;
}
module.exports = module.exports.Queue = Queue;

/**
 * Gets the first value from the queue. The entire queue is closed if
 * the promise fails.
 * 
 * @return {Promise}
 */
Queue.prototype.get = function () {
    var result = this._ends.promise.get("head");
    this._ends.promise = this._ends.promise.get("tail");
    return result.catch(function (error) {
        closed.resolve(error);
        throw error;
    });
};

/**
 * Adds a promise to the back of the queue. Value does not have to be a promise.
 * The promise is added immediately (synchronously).
 * 
 * @param {Any} value
 */
Queue.prototype.put = function (value) {
    var next = defer();
    this._ends.resolve({
        head: value,
        tail: next.promise
    });
    this._ends.resolve = next.resolve;
};

/**
 * Closes the queue. Any subsequent gets will receive a rejected promise with
 * the given error.
 * 
 * @param {Error?} error The rejection error to use when this queue is read.
 * @return {Promise}
 */
Queue.prototype.close = function (error) {
    error = error || new Error("Can't get value from closed queue");
    var end = {head: Promise.reject(error)};
    end.tail = end;
    this._ends.resolve(end);
    return this._closed.promise;
};