var log = require("../common/logging").from(__filename);
var track = require("../common/track");
var Q = require("q");
var exec = require("./exec");
var cp = require("child_process");
var Connection = require("q-connection");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var path = require("path");

exports.Mop = Mop;
exports.init = init;
exports.serveArchivedBuild = serveArchivedBuild;

function init(fs, workspacePath) {
    exports.mop = new Mop(fs, workspacePath);
}

function serveArchivedBuild(request) {
    var archiveLocation;

    return exports.mop.getBuildArchiveLocation()
    .then(function(_archiveLocation) {
        archiveLocation = _archiveLocation;
        return exports.mop._fs.isFile(archiveLocation);
    })
    .then(function(isFile) {
        if (isFile) {
            return HttpApps.file(request, archiveLocation, null, exports.mop._fs)
            .then(function(response) {
                var filename = path.basename(archiveLocation);
                response.headers['Content-Disposition'] = 'attachment; filename="' + filename + '"';
                return response;
            });
        } else {
            return StatusApps.notFound(request);
        }
    });
}

function Mop(fs, workspacePath) {
    this._fs = fs;
    this._workspacePath = workspacePath;
    this._buildsLocation = fs.join(workspacePath, "..", "builds");
}

Mop.prototype.optimize = function(applicationPath, options) {
    var n = cp.fork(__dirname + "/mop-runner.js");
    var connection = Connection(n);

    if (!options) {
        options = {};
    }
    options.buildLocation = this._buildsLocation;

    log("optimize");
    return connection.invoke("optimize", applicationPath, options)
        .finally(function() {
            n.disconnect();
        });
};

Mop.prototype.archive = function() {
    var self = this;
    var buildLocation;
    var archiveLocation;

    return Q.all([this.getBuildLocation(), this.getBuildArchiveLocation()])
    .spread(function(_buildLocation, _archiveLocation) {
        buildLocation = _buildLocation;
        archiveLocation = _archiveLocation;
        return self._fs.exists(archiveLocation);
    })
    .then(function(exists) {
        if (exists) {
            return self._fs.remove(archiveLocation);
        }
    })
    .then(function() {
        var buildLocationParent = path.dirname(buildLocation);
        var buildName = path.basename(buildLocation);

        return exec("zip", ["-r", archiveLocation, buildName], buildLocationParent, false);
    })
    .then(function () {
        return archiveLocation;
    })
    .fail(function (error) {
        track.error(error);
        throw new Error("Creating build archive failed.");
    });
};

Mop.prototype.getPackageDescriptor = function() {
    var packageJsonFilename = this._fs.join(this._workspacePath, "package.json");

    return this._fs.read(packageJsonFilename)
    .then(function(packageJson) {
        return JSON.parse(packageJson);
    });
};

Mop.prototype.getBuildLocation = function() {
    var self = this;

    return this.getPackageDescriptor()
    .then(function(packageDescriptor) {
        return self._fs.join(self._buildsLocation, packageDescriptor.name);
    });
};

Mop.prototype.getBuildArchiveLocation = function() {
    var self = this;

    return this.getPackageDescriptor()
    .then(function(packageDescriptor) {
        return self._fs.join(self._buildsLocation, packageDescriptor.name + ".zip");
    });
};
