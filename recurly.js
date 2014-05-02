var Q = require("q");
var NodeRecurly = require("node-recurly");

module.exports = Recurly;
function Recurly(config) {
    var recurly = new NodeRecurly(config);

    var wrapped = {};

    // loops through accounts, adjustments, billingInfo etc.
    // all the functions have a reference to `recurly` `this`, and so we don't
    // need to preserve `this` when calling
    Object.keys(recurly).forEach(function (apiObject) {
        var originalRoutes = recurly[apiObject];
        var routes = wrapped[apiObject] = {};

        Object.keys(originalRoutes).forEach(function (route) {
            var fn = originalRoutes[route];

            if (route === "list") {
                // The list functions have callback as first
                // argument, followed by an optional filter

                routes[route] = function (filter) {
                    var deferred = Q.defer();
                    fn(deferred.makeNodeResolver(), filter);
                    return deferred.promise;
                };
            } else if (route === "listByAccount") {
                // The listByAccount functions have callback as their second
                // argument, followed by an optional filter

                routes[route] = function (accountCode, filter) {
                    var deferred = Q.defer();
                    fn(accountCode, deferred.makeNodeResolver(), filter);
                    return deferred.promise;
                };
            } else if (apiObject === "transactions" && route === "refund") {
                // The transaction.refund function has a callback as the second
                // argument, followed by an optional amount

                routes[route] = function (id, amount) {
                    var deferred = Q.defer();
                    fn(id, deferred.makeNodeResolver(), amount);
                    return deferred.promise;
                };
            } else {
                // All other functions have the callback as their last argument

                routes[route] = Q.denodeify(fn);
            }
        });
    });

    return wrapped;
}
