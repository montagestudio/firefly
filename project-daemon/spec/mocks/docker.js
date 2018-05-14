const uuid = require("uuid");
const Container = require("./container");
const Network = require("./network");

class MockDocker {
    constructor() {
        this.modem = {
            containers: [],
            networks: [{ id: "firefly_projects" }]
        };
    }

    getContainer(id) {
        return new Container(this.modem, id);
    }

    async listContainers() {
        return this.modem.containers;
    }

    async createContainer(opts) {
        const id = uuid.v4();
        const container = {
            ID: id,
            Names: opts.Name,
            State: {}
        };
        Object.assign(container, opts);
        this.modem.containers.push(container);

        return this.getContainer(id);
    }

    getNetwork(id) {
        return new Network(this.modem, id);
    }
}

module.exports = MockDocker;
MockDocker.prototype.Container = Container;