// Utility class for all the {user, owner, repo} objects we have.
// Implements the `equals` and `hash` methods needed for uniqueness in Sets
// and Maps/

var url = require("url");

var PROJECT_IMAGE_PORT = 2441;
var SERVICE_NAME_REPLACE_RE = /[^a-zA-Z0-9\-]/g;

module.exports = ProjectInfo;
function ProjectInfo(username, owner, repo) {
    this.username = username.toLowerCase();
    this.owner = owner.toLowerCase();
    this.repo = repo.toLowerCase();
}

Object.defineProperties(ProjectInfo, {
    fromObject: {
        value: function (object) {
            if (object instanceof this) {
                return object;
            } else {
                return new this(object.username, object.owner, object.repo);
            }
        }
    },

    fromPath: {
        value: function (path) {
            if (path[0] !== "/") {
                path = "/" + path;
            }
            var parts = path.split("/");
            if (parts.length < 4) {
                throw new TypeError("Cannot build a ProjectInfo object from " + path);
            }
            return new ProjectInfo(parts[1], parts[2], parts[3]);
        }
    }
});

Object.defineProperties(ProjectInfo.prototype, {

    setPrivate: {
        value: function (isPrivate) {
            this.private = isPrivate;
        }
    },

    equals: {
        value: function (other) {
            return this.username === other.username && this.owner === other.owner && this.repo === other.repo;
        }
    },

    hash: {
        value: function () {
            return this.username + "/" + this.owner + "/" + this.repo;
        }
    },

    toString: {
        value: function () {
            return "[ProjectInfo " + this.username + ", " + this.owner + ", " + this.repo + "]";
        }
    },

    toPath: {
        value: function () {
            return "/" + this.username + "/" + this.owner + "/" + this.repo + "/";
        }
    },

    toUrl: {
        value: function (base, path) {
            if (base && path) {
                return url.resolve(url.resolve(base, this.toPath()), path);
            } else if (!path) {
                return url.resolve(base, this.toPath);
            } else if (!base) {
                return url.resolve(this.toPath(), path);
            } else {
                return this.toPath();
            }
        }
    },

    serviceName: {
        get: function () {
            var username = this.username.replace(SERVICE_NAME_REPLACE_RE, "");
            var owner = this.owner.replace(SERVICE_NAME_REPLACE_RE, "");
            var repo = this.repo.replace(SERVICE_NAME_REPLACE_RE, "");

            return username + "_" + owner + "_" + repo;
        }
    },

    url: {
        get: function () {
            return this.serviceName + ":" + PROJECT_IMAGE_PORT;
        }
    }
});
