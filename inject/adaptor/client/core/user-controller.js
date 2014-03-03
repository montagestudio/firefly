var Montage = require("montage").Montage;
var github = require("./github");

exports.UserController = Montage.specialize({
    constructor: {
        value: function UserController() {
            this.super();
        }
    },

    init: {
        value: function() {
            var self = this;

            // TODO Eventually this should populate a user object
            // represented by this controller
            github.githubApi()
                .then(function(githubApi) {
                    return githubApi.getUser();
                })
                .then(function(user) {
                    self.name = user.name || user.login;
                    self.login = user.login;
                    //jshint -W106
                    self.avatarUrl = user.avatar_url;
                    self.url = user.html_url;
                    //jshint +W106
                })
                .done();

            return this;
        }
    }
});
