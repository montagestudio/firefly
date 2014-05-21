var log = require("../logging").from(__filename);
var URL = require("url");
var Set = require("collections/map");
var routeProject = require("../route-project");
var generateAccessCode = require("./generate-access-code");

// Singleton
module.exports = new SubdomainDetailsMap();
// Expose Class for testing
module.exports.SubdomainDetailsMap = SubdomainDetailsMap;

function SubdomainDetailsMap() {
    this.subdomainDetails = {};
    this.detailsSubdomain = Set();
}

SubdomainDetailsMap.prototype.detailsFromSubdomain = function(subdomain) {
    return this.subdomainDetails[subdomain] || false;
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

    return this.detailsFromSubdomain(subdomain);
};

SubdomainDetailsMap.prototype.subdomainFromDetails = function(details) {
    if (this.detailsSubdomain.has(details)) {
        return this.detailsSubdomain.get(details);
    }

    // get "pod" and convert to letter
    var pod = routeProject.podForUsername(details.user);
    var podLetter = String.fromCharCode(96 + pod);
    // generate random code
    // 5 characters give about 4 million combinations
    var random = generateAccessCode(5);

    var subdomain = podLetter + random;
    // store
    this.subdomainDetails[subdomain] = details;
    this.detailsSubdomain.set(details, subdomain);

    log("generated subdomain", subdomain, "for", details.toString());

    // return hash
    return subdomain;
};
