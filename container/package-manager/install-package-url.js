var PackageManagerTools = require("./package-manager-tools"),
    Git = require("../git"),
    FS = require("q-io/fs"),
    Path = require("path"),
    URL = require("url"),
    Q = require("q");

module.exports = function installPackageFromGitUrl (url, gitHubAccessToken, fspath) {

    var _git = new Git(FS, gitHubAccessToken, true),
        _httpsUrl = PackageManagerTools.transformGitUrlToHttpGitUrl(url),
        _nodeModulesPath = Path.join(fspath, "node_modules"),
        _packageName = null,
        _pathToPackage = null;

    function _install () {
        if (_httpsUrl) {
            return FS.exists(_nodeModulesPath).then(function (exists) {
                if (exists) {
                    return _installPackage();
                }

                return FS.makeDirectory(_nodeModulesPath).then(function () {
                    return _installPackage();
                });
            });
        }

        return Q.reject(new Error("wrong git url", url));
    }

    function _installPackage () {
        var resultRegExp = /([0-9a-zA-Z~][\w\-\.~]*)\.git/.exec(_httpsUrl);

        if (Array.isArray(resultRegExp)) {
            _packageName = resultRegExp[1];

            if (_packageName) {
                _pathToPackage = Path.join(_nodeModulesPath, _packageName);

                return FS.exists(_pathToPackage).then(function (exists) {
                    if (exists) {
                        return FS.removeTree(_pathToPackage).then(function () {
                            return _clonePackage();
                        });
                    }

                    return _clonePackage();
                });
            }
        }

        throw new Error("wrong git url", url);
    }


    function _clonePackage () {
        var urlParsed = URL.parse(_httpsUrl),
            commitIsh = urlParsed.hash,// tag, branch, sha
            gitUrl = null;

        if (commitIsh) {
            gitUrl = _httpsUrl.substring(0, _httpsUrl.length - commitIsh.length);
            commitIsh = commitIsh.substr(1); // remove # symbol
        }

        return _git.clone(gitUrl || _httpsUrl, _pathToPackage).then(function () {
            if (commitIsh) {
                return _git.command(_pathToPackage, "checkout", [commitIsh], false).then(function () {
                    return _cleanGitRepo();
                });
            }

            return _cleanGitRepo();

        }).fail(function (error) {
            return FS.exists(_pathToPackage).then(function (exists) {
                if (exists) {
                    return FS.removeTree(_pathToPackage);
                }
            }).finally(function () {
                throw new Error ("cannot install package: " + _packageName + ", error: " + error);
            });
        });
    }

    function _cleanGitRepo () {
        var pathToGitFolder = Path.join(_pathToPackage, ".git");

        return FS.removeTree(pathToGitFolder).then(function () {
            return {
                name: _packageName,
                version: url
            };
        });
    }

    return _install();
};
