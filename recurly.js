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
            var errorFn = makeErrorFunction(apiObject, route);

            if (route === "list") {
                // The list functions have callback as first
                // argument, followed by an optional filter

                routes[route] = function (filter) {
                    var deferred = Q.defer();
                    fn(deferred.makeNodeResolver(), filter);
                    return deferred.promise
                    .catch(errorFn);
                };
            } else if (route === "listByAccount") {
                // The listByAccount functions have callback as their second
                // argument, followed by an optional filter

                routes[route] = function (accountCode, filter) {
                    var deferred = Q.defer();
                    fn(accountCode, deferred.makeNodeResolver(), filter);
                    return deferred.promise
                    .catch(errorFn);
                };
            } else if (apiObject === "transactions" && route === "refund") {
                // The transaction.refund function has a callback as the second
                // argument, followed by an optional amount

                routes[route] = function (id, amount) {
                    var deferred = Q.defer();
                    fn(id, deferred.makeNodeResolver(), amount);
                    return deferred.promise
                    .catch(errorFn);
                };
            } else {
                // All other functions have the callback as their last argument
                routes[route] = function () {
                    // Borrowed from Q
                    // https://github.com/kriskowal/q/blob/7b02ba1163085c74987b036d59c5efbe0ef987d4/q.js#L1781-L1790
                    // so that we can catch rejections
                    var args = Array.prototype.slice.call(arguments);
                    var deferred = Q.defer();
                    args.push(deferred.makeNodeResolver());
                    Q(fn).fapply(args).catch(deferred.reject);

                    return deferred.promise
                    .catch(errorFn);
                };
            }
        });
    });

    return wrapped;
}

// node-recurly errors are actually responses. This converts them
function makeErrorFunction(apiObject, route) {
    return function (response) {
        var error;
        if (response.data && response.data.error && response.data.error.description) {
            error = new Error("Recurly " + route + " " + apiObject + " error: " + response.data.error.description._);
        } else {
            error = new Error("Recurly " + route + " " + apiObject + " error");
        }
        error.data = response.data;

        throw error;
    };
}

// { statusCode: 404,
//   headers:
//    { server: 'Blackhole',
//      date: 'Fri, 02 May 2014 18:54:38 GMT',
//      'content-type': 'application/xml; charset=utf-8',
//      'transfer-encoding': 'chunked',
//      connection: 'close',
//      vary: 'Accept-Encoding',
//      'content-language': 'en-US',
//      'cache-control': 'no-cache',
//      'x-request-id': 'a5nn5g42kve8o6t8mc20' },
//   data: { error: { symbol: 'not_found', description: { _: 'Couldn\'t find Account with account_code = asdasdf',
  // '$': { lang: 'en-US' } } } } }
