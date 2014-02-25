var Montage = require("montage").Montage;
    github = require("./github");

exports.UserController = Montage.specialize({
    constructor: {
        value: function UserController() {
            this.super();
        }
    },

    init: {
        value: function () {
            return this;
        }
    },

    _user: {
        value: null
    },

    user: {
        get: function () {
            if (!this._user) {
                this.getUser().done();
            }

            return this._user;
        }
    },

    getUser: {
        value: function () {

            var self = this;

            return github.githubApi()
                .then(function(githubApi) {
                    return githubApi.getUser();
                })
                .then(function(record) {
                    var user = Object.create(null);
                    user.name = record.name || record.login;
                    user.login = record.login;
                    //jshint -W106
                    user.avatarUrl = record.avatar_url;
                    user.url = record.html_url;
                    //jshint +W106

                    self.dispatchBeforeOwnPropertyChange("user", self._user);
                    self._user = user;
                    self.dispatchOwnPropertyChange("user", self._user);

                    return user;
                });
        }
    }
});
