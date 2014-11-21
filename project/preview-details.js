// Utility class for all the {user, owner, repo} objects we have.
// Implements the `equals` and `hash` methods needed for uniqueness in Sets
// and Maps/

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

PreviewDetails.prototype.setPrivate = function(isPrivate) {
    this.private = isPrivate;
}

PreviewDetails.prototype.equals = function (other) {
    return this.username === other.username && this.owner === other.owner && this.repo === other.repo;
};

PreviewDetails.prototype.hash = function () {
    return this.username + "/" + this.owner + "/" + this.repo;
};

PreviewDetails.prototype.toString = function () {
    return "[PreviewDetails " + this.username + ", " + this.owner + ", " + this.repo + "]";
};
