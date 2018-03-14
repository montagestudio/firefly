// TODO: Remove?
/**
 * The purpose is to determine the project pod a user will connect to and to route the request appropriately
 * Created by pierre on 2/12/2014.
 */
var Env = require("./environment");

var routeProject = {
    // Empty
};
// NOTE
exports = module.exports = routeProject;

routeProject.addRouteProjectCookie = function (request, response) {
    var setCookies = response.headers["set-cookie"];
    if (!setCookies) {
        setCookies = [];
    } else if (!Array.isArray(setCookies)) {
        setCookies = [setCookies];
    }
    if (!request.session.podNumber) {
        request.session.podNumber = routeProject.podForUsername(request.session.username);
    }
    var cookie = "project=P" + request.session.podNumber + "; Path=/;";
    setCookies.push(cookie);
    response.headers["set-cookie"] = setCookies;
    return response;
};

routeProject.podForUsername = function (username) {
    return routeProject.checksum(username.toLowerCase()) % Env.projectServers + 1;
};

routeProject.checksum = function (s) {
    var hash = 0,
        strlen = (s ? s.length : 0),
        i,
        c;
    if (strlen === 0) {
        return hash;
    }
    //jshint -W016
    for (i = 0; i < strlen; i++) {
        c = s.charCodeAt(i);
        hash = ((hash << 5) - hash ) + c;
        hash = hash & hash; // Convert to 32bit integer
    }
    //jshint +W016
    return (hash > 0 ? hash : -hash);
};
