var log = require("../logging").from(__filename);
var Q = require("q");

module.exports = GitCommitBatchFactory;

function GitCommitBatchFactory(repositoryService, git, repoPath) {
    var _repositoryService = repositoryService,
        _git = git,
        _repoPath = repoPath,
        _commitBatches = [];            // List of all pending batches

    function _commitBatch(batch) {
        _repositoryService.commitBatch(batch)
        .then(function(result) {
            batch._deferredCommit.resolve(result);
        }, function(error) {
            batch._deferredCommit.reject(error);
        }).finally(function() {
            // remove the batch from the commitBatches list if still in it
            var pos = _commitBatches.indexOf(batch);
            if (pos !== -1) {
                _commitBatches.splice(pos, 1);
            }
            _commit();
        });
    }

    function _commit() {
        var nbrBatches = _commitBatches.length,
            i;

        for (i = 0; i < nbrBatches; i ++) {
            var batch = _commitBatches[i];
            if (batch._readyToBeCommitted && !batch._committed) {
                batch._committed = true;
                if (batch._addedFiles.length) {
                    _git.add(_repoPath, batch._addedFiles);
                }
                if (batch._removedFiles.length) {
                    _git.rm(_repoPath, batch._removedFiles);
                }

                _commitBatch(batch);
                break;
            } else if (!batch._deferredCommit || Q.isPending(batch._deferredCommit.promise)) {
                // We cannot process other batches if we are not done with the current one.
                break;
            }
        }
    }

    function GitCommitBatch(message) {
        this.message = message;

        this._addedFiles = [];
        this._removedFiles = [];
        this._readyToBeCommitted = false;
        this._committed = false;
        this._deferredCommit = null;

        // Insert the new batch at the end of the pending batches
        _commitBatches.push(this);
    }

    GitCommitBatch.prototype.stageFiles = function(files) {
        if (Array.isArray(files)) {
            this._addedFiles.push.apply(this._addedFiles, files);
        } else {
            this._addedFiles.push(files);
        }
    };

    GitCommitBatch.prototype.stageFilesForDeletion = function(files) {
        if (Array.isArray(files)) {
            this._removedFiles.push.apply(this._removedFiles, files);
        } else {
            this._removedFiles.push(files);
        }
    };

    GitCommitBatch.prototype.cancel = function() {
        var pos = _commitBatches.indexOf(this);
        if (pos !== -1) {
            _commitBatches.splice(_commitBatches.indexOf(this), 1);
            // note: right now, we are not able to cancel the git commit if it has already started!
        }
        // Jump start any pending commit...
        _commit();
    };

    GitCommitBatch.prototype.commit = function(message) {
        if (!this._deferredCommit) {
            if (message) {
                this.message = message;
            }
            this._readyToBeCommitted = true;
            this._deferredCommit = Q.defer();
            _commit();
        }

        return this._deferredCommit.promise;
    };

    /**
     * For debugging purpose only
     * @private
     */
    GitCommitBatch.prototype._dump = function() {
        var nbrBatches = _commitBatches.length,
            i;

        log("Dumping Commit " + nbrBatches + " Batch");
        for (i = 0; i < nbrBatches; i ++) {
            var batch = _commitBatches[i];
            log("Batch #", i + 1);
            log("  message:", batch.message);
            log("  added files:", batch._addedFiles);
            log("  removed files:", batch._removedFiles);
            log("  commit pending:", batch._readyToBeCommitted ? "yes" : "no");
            log("  committed:", batch._committed ? "yes" : "no");
            log("  commit completed:", !batch._deferredCommit || Q.isPending(batch._deferredCommit.promise) ? "no" : "yes");
        }
    };

    return GitCommitBatch;
}
