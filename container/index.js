// If root drop to unprivileged user
if (process.getgid() === 0) {
    process.setgid("montage");
    process.setuid("montage");
}

var HTTP = require("http");
var URL = require("url");

var server = HTTP.createServer(function (request, response) {
    console.log("got request", request);
    var url = URL.parse(request.url, true);

    if (url.pathname === "/workspace") {
        console.log("workspace", request.url);
        response.setHeader("Content-Type", "application/json");
        response.writeHead(200);
        response.end(JSON.stringify({created: false}));
    } else if (url.pathname === "/check") {
        console.log("check");
        response.writeHead(200);
        response.end();
    // } else if (url.pathname === "/shutdown") {
    //     console.log("shutdown", request.url);
    //     response.writeHead(200);
    //     response.end();
    //     server.close();
    //     process.exit(0);
    } else {
        console.log("not found", request.url);
        response.setHeader("Content-Type", "text/plain");
        response.writeHead(404, "Not found");
        response.end("Not found");
    }
});
server.listen(2441);

console.log("Listening");
