var SubdomainDetailsMap = require("../../project/subdomain-details-map").SubdomainDetailsMap;

describe("SubdomainDetailsMap", function () {
    var subdomainDetailsMap, details;
    beforeEach(function () {
        subdomainDetailsMap = new SubdomainDetailsMap();
        details = {
            user: "user",
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
        expect(returnedDetails).toBe(details);
    });

    it("returns the same subdomain for the same details", function () {
        var first = subdomainDetailsMap.subdomainFromDetails(details);
        var second = subdomainDetailsMap.subdomainFromDetails(details);
        expect(first).toEqual(second);
    });
});
