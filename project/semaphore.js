var Queue = require("q/queue");

exports.Semaphore = class Semaphore {
    constructor() {
        this._semaphore = new Queue();
        this._semaphore.put(); // once for one job at a time
    }

    /**
     * Wraps any function with exclusive to make sure it wont execute before all
     * pending exclusive methods are done.
     */
    exclusive(method) {
        const semaphore = this._semaphore;
        return async function wrapped() {
            const args = Array.prototype.slice.call(arguments);
            try {
                await semaphore.get();
                return method.apply(this, args);
            } finally {
                semaphore.put();
            }
        }
    }
}
