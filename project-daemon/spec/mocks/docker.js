var Q = require("q");
var uuid = require("uuid");


module.exports = MockDocker;
function MockDocker() {
    this.services = [];
    this.tasks = [];
}

MockDocker.prototype.getService = function (name) {
    var self = this;
    return {
        id: uuid.v4(),
        inspect: function () {
            var info = self.services.filter(function (service) {
                return service.Spec.Name === name;
            })[0];
            if (info) {
                return Q(info);
            } else {
                return Q.reject(new Error("Service does not exist"));
            }
        }
    };
};

MockDocker.prototype.listServices = function () {
    return Q(this.services);
};

MockDocker.prototype.createService = function (opts) {
    var self = this;
    var service = {
        ID: uuid.v4(),
        Spec: opts
    };
    this.services.push(service);
    var task = {
        Status: {
            State: "running"
        }
    };
    this.tasks.push(task);

    return Q({
        id: service.ID,
        inspect: function () {
            return Q(opts);
        },
        remove: function () {
            self.services.splice(self.services.indexOf(service), 1);
            self.tasks.splice(self.tasks.indexOf(task), 1);
            return Q.resolve();
        }
    });
};

MockDocker.prototype.listTasks = function () {
    return Q(this.tasks);
};
