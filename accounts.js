var log = require("./logging").from(__filename);
var track = require("./track");
var Q = require("q");
var Recurly = require("./recurly");

var SUBSCRIPTIONS = require("./subscriptions");

// FIXME pull from env
module.exports = new Accounts(new Recurly({API_KEY: "cafb8772d12945fb972e2f45dbf90512", SUBDOMAIN: "montage-studio"}));
module.exports.Accounts = Accounts;

function Accounts(recurly) {
    if (!recurly) {
        throw new Error("Recurly must be given");
    }

    this.cache = {};
    this.recurly = recurly;
}

Accounts.prototype.create = function(username, infoPromise) {
    var self = this;
    var accountCode = this.accountCode(username);

    log("Creating recurly account", accountCode);

    Q.when(infoPromise, function (info) {
        return self.recurly.accounts.create({
            account_code: accountCode,
            username: username,
            email: info.email
        })
        .catch(function (error) {
            track.errorForUsername(error, username);
            throw error;
        });
    });
};

Accounts.prototype.get = function(username) {
    var accountCode = this.accountCode(username);
    return this.recurly.accounts.get(accountCode);
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
        return SUBSCRIPTIONS[plan];
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
