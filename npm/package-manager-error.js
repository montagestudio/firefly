var PackageManagerError = function PackageManagerError (message, code) {
    this.name = "PackageManagerError";
    this.message = message;
    this.code = code;
    this.stack = (new Error()).stack;
};

PackageManagerError.prototype = Object.create(Error.prototype);

module.exports = PackageManagerError;
