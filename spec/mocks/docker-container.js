var Q = require("q");

module.exports = MockContainer;
function MockContainer(_, id) {
    this.id = id;
    this.info = {
        "Id": id,
        // "Created": "2013-05-07T14:51:42.041847+02:00",
        // "Path": "date",
        // "Args": [],
        // "Config": {
        //     "Hostname": "4fa6e0f0c678",
        //     "User": "",
        //     "Memory": 0,
        //     "MemorySwap": 0,
        //     "AttachStdin": false,
        //     "AttachStdout": true,
        //     "AttachStderr": true,
        //     "PortSpecs": null,
        //     "Tty": false,
        //     "OpenStdin": false,
        //     "StdinOnce": false,
        //     "Env": null,
        //     "Cmd": [
        //         "date"
        //     ],
        //     "Dns": null,
        //     "Image": "base",
        //     "Volumes": {},
        //     "VolumesFrom": "",
        //     "WorkingDir": ""

        // },
        "State": {
            "Running": false,
            // "Pid": 0,
            // "ExitCode": 0,
            // "StartedAt": "2013-05-07T14:51:42.087658+02:01360",
            // "Ghost": false
        },
        // "Image": "b750fe79269d2ec9a3c593ef05b4332b1d1a02a62b4accb2c21d589ff2f5f2dc",
        // "NetworkSettings": {
        //     "IpAddress": "",
        //     "IpPrefixLen": 0,
        //     "Gateway": "",
        //     "Bridge": "",
        //     "PortMapping": null
        // },
        // "SysInitPath": "/home/kitty/go/src/github.com/dotcloud/docker/bin/docker",
        // "ResolvConfPath": "/etc/resolv.conf",
        // "Volumes": {}
    };
}

MockContainer.prototype.start = function () {
    this.info.State.running = true;
    this.info.HostConfig = {
        // "Binds": null,
        // "ContainerIDFile": "",
        // "LxcConf": [],
        // "Privileged": false,
        "PortBindings": {
            "2441/tcp": [{
                "HostIp": "127.0.0.1",
                "HostPort": "1234"
            }]
        },
        // "Links": null,
        // "PublishAllPorts": false
    };
    return Q();
};

MockContainer.prototype.inspect = function () {
    return Q(this.info);
};

MockContainer.prototype.stop = function () {
    this.info.State.running = false;
    delete this.info.HostConfig;
    return Q();
};

MockContainer.prototype.remove = function () {
    this.id = null;
    this.info = null;
    return Q();
};
