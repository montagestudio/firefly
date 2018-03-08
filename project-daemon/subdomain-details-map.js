var log = require("../logging").from(__filename);
var Set = require("collections/map");
var routeProject = require("../common/route-project");
var generateAccessCode = require("./generate-access-code");

// Singleton
module.exports = new SubdomainDetailsMap();
// Expose Class for testing
module.exports.SubdomainDetailsMap = SubdomainDetailsMap;

function SubdomainDetailsMap() {
    this.subdomainDetails = {};
    this.detailsSubdomain = new Set();
}

SubdomainDetailsMap.prototype.detailsFromSubdomain = function(subdomain) {
    return this.subdomainDetails[subdomain] || false;
};

/**
 * Returns the detail for a given url path.
 * @param {String} path The path of the url, e.g. /ajzijdhqfi/ui/main.reel/main.html
 */
SubdomainDetailsMap.prototype.detailsFromPath = function (path) {
    var pathFragments = path.split("/");
    var subdomain = pathFragments[0].length ? pathFragments[0] : pathFragments[1];

    return this.detailsFromSubdomain(subdomain);
};

SubdomainDetailsMap.prototype.subdomainFromDetails = function(details) {
    if (this.detailsSubdomain.has(details)) {
        return this.detailsSubdomain.get(details);
    }

    // get "pod" and convert to letter
    var pod = routeProject.podForUsername(details.username);
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
