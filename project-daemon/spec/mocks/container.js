module.exports = class Container {
    constructor(modem, id) {
        this.modem = modem;
        this.id = id;
    }

    async inspect() {
        const info = this.modem.containers.filter((container) => container.ID === this.id)[0];
        if (info) {
            return info;
        } else {
            throw new Error('Container does not exist');
        }
    }

    async start() {
        const info = this.modem.containers.filter((container) => container.ID === this.id)[0];
        if (info.PortBindings) {
            info.NetworkSettings = info.NetworkSettings || {Ports: []};
            info.NetworkSettings.Ports[Object.keys(info.PortBindings)[0]] = [{ HostPort: "1234" }];
        }
    }

    async stop() {

    }

    async remove() {
        const info = this.modem.containers.filter((container) => container.ID === this.id)[0];
        if (info) {
            this.modem.containers.splice(this.modem.containers.indexOf(info));
        } else {
            throw new Error("Container does not exist");
        }
    }
}
