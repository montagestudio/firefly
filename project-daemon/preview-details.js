// Utility class for all the {user, owner, repo} objects we have.
// Implements the `equals` and `hash` methods needed for uniqueness in Sets
// and Maps/

var url = require("url");

module.exports = PreviewDetails;
function PreviewDetails(username, owner, repo) {
    this.username = username.toLowerCase();
    this.owner = owner.toLowerCase();
    this.repo = repo.toLowerCase();
}

PreviewDetails.fromObject = function (object) {
    if (object instanceof this) {
        return object;
    } else {
        return new this(object.username, object.owner, object.repo);
    }
};

PreviewDetails.fromPath = function (url) {
    if (url[0] !== "/") {
        url = "/" + url;
    }
    var parts = url.split("/");
    if (parts.length < 4) {
        throw new TypeError("Cannot build a PreviewDetails object from " + url);
    }
    return new PreviewDetails(parts[1], parts[2], parts[3]);
};

PreviewDetails.prototype.setPrivate = function(isPrivate) {
    this.private = isPrivate;
};

PreviewDetails.prototype.equals = function (other) {
    return this.username === other.username && this.owner === other.owner && this.repo === other.repo;
};

PreviewDetails.prototype.hash = function () {
    return this.username + "/" + this.owner + "/" + this.repo;
};

PreviewDetails.prototype.toString = function () {
    return "[PreviewDetails " + this.username + ", " + this.owner + ", " + this.repo + "]";
};

PreviewDetails.prototype.toPath = function () {
    return "/" + this.username + "/" + this.owner + "/" + this.repo + "/";
};

PreviewDetails.prototype.toUrl = function (base, path) {
    if (base && path) {
        return url.resolve(url.resolve(base, this.toPath()), path);
    } else if (!path) {
        return url.resolve(base, this.toPath);
    } else if (!base) {
        return url.resolve(this.toPath(), path);
    } else {
        return this.toPath();
    }
};
