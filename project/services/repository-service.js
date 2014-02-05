//var log = require("logging").from(__filename);
//var Q = require("q");
var Git = require("../git");


module.exports = exports = RepositoryService;

var SHADOW_BRANCH_PREFIX = "__mb__";


function RepositoryService(session, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    var _git = new Git(fs, session.githubAccessToken);

    service.listBranches = function() {
        return _git.fetch(fsPath).then(function() {
            return _git.branch(fsPath, ["-a", "-v", "--no-abbrev"]).then(function(output) {
                var result = {
                    current:null,
                    branches:[]
                };

                var _getBranchForName = function(name) {
                    var branches = result.branches;
                    var length = branches.length;
                    var i;

                    for (i = 0; i < length; i ++) {
                        if (branches[i].name === name) {
                            return branches[i];
                        }
                    }

                    var branch = {name: name};
                    branches.push(branch);
                    return branch;
                };

                var _decodeLine = function(parsedLine) {
                    var current = (parsedLine[1] === "* ");
                    var fullPath = parsedLine[2];
                    var sha = parsedLine[3];
                    // var commitcomment = parsedLine[4];
                    var shadowBranch = false;

                    if (sha !== "->" && fullPath.charAt(0) !== "(") {   // Skip alias branch (like HEAD) and detached branch
                        // Split the fullPath into path and name
                        var firstPos = fullPath.indexOf('/');
                        var lastPos = fullPath.lastIndexOf('/');
                        var name;
                        var remote = null;
                        if (lastPos !== -1) {
                            name = fullPath.substring(lastPos + 1);
                            remote = fullPath.substring(firstPos + 1, lastPos);
                        } else {
                            name = fullPath;
                            remote = null;
                        }

                        // Checking for a shadow branch
                        if (name.indexOf(SHADOW_BRANCH_PREFIX) === 0) {
                            shadowBranch = true;
                            name = name.substring(SHADOW_BRANCH_PREFIX.length);
                        }

                        var branch = _getBranchForName(name);
                        var item;

                        if (remote) {
                            branch.remotes = branch.remotes || {};
                            branch.remotes[remote] = branch.remotes[remote] || {};
                            item = branch.remotes[remote];
                        } else {
                            branch.local = branch.local || {};
                            item = branch.local;
                        }

                        if (shadowBranch) {
                            item.shadow = {
                                name: SHADOW_BRANCH_PREFIX + name,
                                sha: sha
                            };
                        } else {
                            item.sha = sha;
                        }

                        if (current) {
                            result.current = branch;
                        }
                    }
                };

                output.split(/\r?\n/).forEach(function(line){
                    if (line.length) {
                        /*
                            type of git branch output output this method can parse:

                            * (detached from origin/widgets)         5c820daeded35c004fe7c250f52265acdf956196 Filament Checkbox styles      // Will be ignored
                              master                                 dccd034849028653a944d0f82842f802080657bb Update palette and matte
                              __mb__master                           dccd034849028653a944d0f82842f802080657bb Update palette and matte      // shadow branch
                              remotes/fork/markdown-editor           799e0a2e7367bf781243ca64aa1892aae0eeaad1 Add a simple markdown editor
                              remotes/origin/HEAD                    -> origin/master                                                       // Will be ignored
                         */
                        var parsedLine = line.match(/([ *]+)(\([^)]+\)|[^ ]+)[ ]+([^ ]+)[ ]+(.*)/);
                        if (parsedLine.length === 5) {
                            _decodeLine(parsedLine);
                        }
                    }
                });
                return result;
            });
        });
    };

    return service;
}
