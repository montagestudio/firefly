var URL = require("url");
var Map = require("collections/map");
var routeProject = require("../route-project");
var generateAccessCode = require("./generate-access-code");

// Singleton
module.exports = new SubdomainDetailsMap();
// Expose Class for testing
module.exports.SubdomainDetailsMap = SubdomainDetailsMap;

function SubdomainDetailsMap() {
    this.map = {};
}

SubdomainDetailsMap.prototype.detailsFromSubdomain = function(subdomain) {
    if (this.map.hasOwnProperty(subdomain)) {
        return this.map[subdomain];
    }

    return false;
};

SubdomainDetailsMap.prototype.detailsFromUrl = function(url) {
    // Needed because node's URL.parse interprets
    // a.b.c.com:1234
    // as
    // protocol: "a.b.c.d.com"
    // hostname: "2440"
    if (!/^https?:\/\//.test(url)) {
        url = "http://" + url;
    }

    var hostname = URL.parse(url).hostname;
    var subdomain = hostname.split(".")[0];

    return this.getFromSubdomain(subdomain);
};

SubdomainDetailsMap.prototype.subdomainFromDetails = function(details) {
    // get "pod" and convert to letter
    var pod = routeProject.podForUsername(details.user);
    var podLetter = String.fromCharCode(96 + pod);
    // generate random code
    // 5 characters give about 4 million combinations
    var random = generateAccessCode(5);

    var subdomain = podLetter + random;
    // store in map
    this.map[subdomain] = details;
    // return hash
    return subdomain;
};
