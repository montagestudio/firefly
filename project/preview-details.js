// Utility class for all the {user, owner, repo} objects we have.
// Implements the `equals` and `hash` methods needed for uniqueness in Sets
// and Maps/

module.exports = PreviewDetails;
function PreviewDetails(user, owner, repo) {
    this.user = user.toLowerCase();
    this.owner = owner.toLowerCase();
    this.repo = repo.toLowerCase();
}

PreviewDetails.fromObject = function (object) {
    if (object instanceof this) {
        return object;
    } else {
        return new this(object.user, object.owner, object.repo);
    }
};

PreviewDetails.prototype.equals = function (other) {
    return this.user === other.user && this.owner === other.owner && this.repo === other.repo;
};

PreviewDetails.prototype.hash = function () {
    return this.user + "/" + this.owner + "/" + this.repo;
};

PreviewDetails.prototype.toString = function () {
    return "[PreviewDetails " + this.user + ", " + this.owner + ", " + this.repo + "]";
};
