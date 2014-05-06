// A lot of the Recurly API keys are underscored
/*jshint camelcase:false */
var log = require("./logging").from(__filename);
var track = require("./track");
var Q = require("q");
var Recurly = require("./recurly");

var RECURLY_API_KEY = process.env.RECURLY_API_KEY;
var RECURLY_SUBDOMAIN = process.env.RECURLY_SUBDOMAIN;

module.exports = new Accounts(
    new Recurly({API_KEY: RECURLY_API_KEY, SUBDOMAIN: RECURLY_SUBDOMAIN}),
    require("./subscriptions.json")
);
module.exports.Accounts = Accounts;

function Accounts(recurly, subscriptions) {
    if (!recurly || !subscriptions) {
        throw new Error("Recurly and subscriptions must be given");
    }

    // this.cache = {};
    this.recurly = recurly;
    this.subscriptions = subscriptions;
}

Accounts.prototype.create = function(username, infoPromise) {
    var self = this;
    var accountCode = this.getAccountCode(username);

    log("Creating recurly account", accountCode);

    return Q.when(infoPromise, function (info) {
        return self.recurly.accounts.create({
            account_code: accountCode,
            username: username,
            email: info.email
        })
        .then(function (response) {
            return response.data.account;
        })
        .catch(function (error) {
            track.errorForUsername(error, username);
            throw error;
        });
    });
};

Accounts.prototype.get = function(username) {
    var accountCode = this.getAccountCode(username);
    return this.recurly.accounts.get(accountCode)
    .then(function (response) {
        return response.data.account;
    });
};

Accounts.prototype.getOrCreate = function(username, infoPromise) {
    var self = this;

    return this.get(username)
    .catch(function (error) {
        if (error.data.error && error.data.error.symbol === "not_found") {
            // no account for this user, create one
            return self.create(username, infoPromise);
        } else {
            throw error;
        }
    });
};

Accounts.prototype.getFeatures = function(username) {
    var self = this;
    var accountCode = this.getAccountCode(username);
    return this.recurly.subscriptions.listByAccount(accountCode)
    .then(function (response) {
        var plan = "none";
        if (response.data.subscriptions.subscription) {
            plan = self.getPlanFromCode(response.data.subscriptions.subscription.plan.plan_code);
        }
        return self.subscriptions[plan];
    });
};

Accounts.prototype.clearCache = function(username) {

};

Accounts.prototype.getAccountCode = function(username) {
    return "gh_" + username;
};

// Plan codes consist of: planName "-" planPeriod
// For example: basic-monthly, basic-yearly, pro-monthly, pro-yearly
// To get the plan we just need to take the text before the first "-"
Accounts.prototype.getPlanFromCode = function(recurlyPlanCode) {
    return recurlyPlanCode.split("-")[0];
};
