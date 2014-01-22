/*
 * FIXME [PJYF Jan 21 2014] This file is a place holder.
 * The real server proxy need to be written
 */


var REPL = require("repl");
var HTTP = require("http");
var Q = require("q");
var Docker = require("dockerode");

var IMAGE_NAME = "firefly_project";
var IMAGE_PORT = "2441";
var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";

var docker = new Docker({socketPath: "/var/run/docker.sock"});

var CONTAINERS = {};

function start() {
    return Q.ninvoke(docker, "createContainer", {
        Image: IMAGE_NAME,
        // PublishAllPorts: true
        // PortSpecs: [IMAGE_PORT]
    })
    .then(function (container) {
        var id = container.id;
        var xxx = CONTAINERS[id] = {
            id: container.id,
            container: container
        };

        var options = {};
        options.PortBindings = {};
        // only bind to the local IP
        options.PortBindings[IMAGE_PORT_TCP] = [{HostIp: "127.0.0.1"}];
        return Q.ninvoke(container, "start", options)
        .then(function (data) {
            return Q.ninvoke(container, "inspect");
        })
        .then(function (info) {
            xxx.info = info;
            xxx.port = info.HostConfig.PortBindings[IMAGE_PORT_TCP][0].HostPort;
            return xxx;
        });
    });
}

function stop(id) {
    var done = Q.defer();
    var xxx = CONTAINERS[id];
    var request = HTTP.request({port: xxx.port, path: "/shutdown"});
    request.on("error", done.reject);
    request.on("response", function (response) {
        response.on("end", done.resolve);
    });
    request.end();

    return done.promise.then(function () {
        return Q.ninvoke(xxx.container, "stop");
    })
    .then(function () {
        return Q.ninvoke(xxx.container, "remove");
    });
}

var repl = REPL.start("> ");
repl.context.docker = docker;
repl.context.start = start;
repl.context.stop = stop;
repl.context.containers = CONTAINERS;