var PackageManagerError = function PackageManagerError (message, code) {
    this.name = "PackageManagerError";
    this.message = message;
    this.code = code;
};

PackageManagerError.prototype = new Error();

module.exports = PackageManagerError;
