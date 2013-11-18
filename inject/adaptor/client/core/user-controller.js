var Montage = require("montage").Montage;
var github = require("./github");

var UserController = Montage.specialize({
    constructor: {
        value: function UserController() {
            this.super();
        }
    },

    init: {
        value: function() {
            var self = this;

            return github.githubApi()
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
                return self;
            });
        }
    }
});

exports.userController = new UserController().init();
