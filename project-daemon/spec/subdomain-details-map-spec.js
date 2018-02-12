var SubdomainDetailsMap = require("../subdomain-details-map").SubdomainDetailsMap;

describe("SubdomainDetailsMap", function () {
    var subdomainDetailsMap, details;
    beforeEach(function () {
        subdomainDetailsMap = new SubdomainDetailsMap();
        details = {
            username: "username",
            owner: "owner",
            repo: "repo"
        };
    });

    it("generates a subdomain", function () {
        var subdomain = subdomainDetailsMap.subdomainFromDetails(details);
        expect(subdomain.length).toEqual(6);
        // put on the first server
        expect(subdomain.charAt(0)).toEqual("a");
    });

    it("gets the details for a given subdomain", function () {
        var subdomain = subdomainDetailsMap.subdomainFromDetails(details);
        var returnedDetails = subdomainDetailsMap.detailsFromSubdomain(subdomain);
        expect(returnedDetails.username).toEqual("username");
        expect(returnedDetails.owner).toEqual("owner");
        expect(returnedDetails.repo).toEqual("repo");
    });

    it("returns the same subdomain for the same details", function () {
        var first = subdomainDetailsMap.subdomainFromDetails(details);
        var second = subdomainDetailsMap.subdomainFromDetails(details);
        expect(first).toEqual(second);
    });
});
