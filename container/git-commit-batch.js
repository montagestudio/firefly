var Q = require("q");

module.exports = GitCommitBatchFactory;

function GitCommitBatchFactory(repositoryService) {
    var _repositoryService = repositoryService,
        _commitBatches = [];            // List of all pending batches

    function _commitBatch(batch) {
        _repositoryService.commitBatch(batch)
        .then(function(result) {
            batch._deferredCommit.resolve(result);
        }, function(error) {
            batch._deferredCommit.reject(error);
        })
        .finally(function() {
            // Release the batch now that we are done with it
            batch.release();
        });
    }

    function _commit() {
        var nbrBatches = _commitBatches.length,
            i;

        for (i = 0; i < nbrBatches; i ++) {
            var batch = _commitBatches[i];
            if (batch._readyToBeCommitted && !batch._committed) {
                batch._committed = true;
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

    GitCommitBatch.prototype.release = function() {
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
     * For debugging and testing purpose only
     * @private
     */
    GitCommitBatchFactory._batches = function() {
        return _commitBatches;
    };

    return GitCommitBatch;
}

