// A lot of the Recurly API keys are underscored
/*jshint camelcase:false */
var Q = require("q");
var Accounts = require("../accounts").Accounts;

describe("Accounts", function () {
    var accounts, recurly, subscriptions;
    beforeEach(function () {
        var emptyResponse = {
            statusCode: 200,
            headers: {},
            data: {}
        };
        recurly = {
            accounts: {
                create: jasmine.createSpy().andReturn(Q(emptyResponse)),
                get: jasmine.createSpy().andReturn(Q(emptyResponse))
            },
            subscriptions: {
                listByAccount: jasmine.createSpy().andReturn(Q(emptyResponse))
            }
        };
        subscriptions = {};
        accounts = new Accounts(recurly, subscriptions);
    });

    describe("create", function () {
        it("creates an account with namespaced account code and email address from info", function (done) {
            recurly.accounts.create = function (details) {
                return Q({data: {account: details}});
            };

            accounts.create("test", Q({email: "test@example.com"}))
            .then(function (account) {
                expect(account).toEqual({
                    account_code: "gh_test",
                    username: "test",
                    email: "test@example.com"
                });
            })
            .done(done, done);
        });
    });

    describe("get", function () {
        it("gets an account with the namespaced account code", function (done) {
            recurly.accounts.get = function (details) {
                return Q({data: {account: {
                    account_code: "gh_test",
                    username: "test",
                    email: "test@example.com"
                }}});
            };

            accounts.get("test")
            .then(function (account) {
                expect(account).toEqual({
                    account_code: "gh_test",
                    username: "test",
                    email: "test@example.com"
                });
            })
            .done(done, done);
        });
    });

    describe("getOrCreate", function () {
        it("gets an account if it exists already", function (done) {
            recurly.accounts.get = function (accountCode) {
                return Q({data: {account: {account_code: accountCode, email: "test@example.com"}}});
            };
            accounts.getOrCreate("test")
            .then(function (account) {
                expect(account).toEqual({account_code: "gh_test", email: "test@example.com"});
            })
            .done(done, done);
        });

        it("creates an account if it does not exist already", function (done) {
            recurly.accounts.get = function (accountCode) {
                var error = new Error();
                error.data = {error: {symbol: "not_found"}};
                return Q.reject(error);
            };
            recurly.accounts.create = function (details) {
                return Q({data: { account: details }});
            };
            accounts.getOrCreate("test", Q({email: "test@example.com"}))
            .then(function (account) {
                expect(account).toEqual({account_code: "gh_test", username: "test", email: "test@example.com"});
            })
            .done(done, done);
        });
    });

    describe("getFeatures", function () {
        var subscription;
        beforeEach(function () {
            subscriptions.none = { none: true };
            subscriptions.one = { one: true };

            subscription = null;
            recurly.subscriptions.listByAccount = function (accountCode) {
                return Q({data: {subscriptions: { subscription: subscription }}});
            };
        });

        it("returns the 'none' features by default", function (done) {
            accounts.getFeatures("test")
            .then(function (features) {
                expect(features).toEqual({none: true});
            })
            .done(done, done);
        });

        it("returns the plan features", function (done) {
            subscription = {plan: { plan_code: "one" }};
            accounts.getFeatures("test")
            .then(function (features) {
                expect(features).toEqual({one: true});
            })
            .done(done, done);
        });

        it("uses only the plan_code before the first dash", function (done) {
            subscription = {plan: { plan_code: "one-yearly" }};
            accounts.getFeatures("test")
            .then(function (features) {
                expect(features).toEqual({one: true});
            })
            .done(done, done);
        });
    });

});
