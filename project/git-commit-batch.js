var Q = require("q");

module.exports = GitCommitBatchFactory;

function GitCommitBatchFactory(repositoryService) {
    var _repositoryService = repositoryService,
        _commitBatches = [];            // List of all pending batches

    var BATCH_COMMIT_STATE = {
        open: 1,
        willCommit: 2,
        committed: 3,
        done: 4
    };

    function _commitBatch(batch) {
        batch._state = BATCH_COMMIT_STATE.committed;

        _repositoryService.commitBatch(batch)
        .then(function(result) {
            batch._state = BATCH_COMMIT_STATE.done;
            batch._deferred.resolve(result);
        }, function(error) {
            batch._state = BATCH_COMMIT_STATE.done;
            batch._deferred.reject(error);
        })
        .finally(function() {
            // Release the batch now that we are done with it
            batch.release();
        });
    }

    function _commit() {
        _commitBatches.some(function(batch) {
            if (batch._state === BATCH_COMMIT_STATE.willCommit) {
                _commitBatch(batch);
            }
            return true;
        });
    }

    function GitCommitBatch(message) {
        this.message = message;

        this._addedFiles = [];
        this._removedFiles = [];
        this._state = BATCH_COMMIT_STATE.open;
        this._deferred = null;

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
        if (!this._deferred) {
            this._state = BATCH_COMMIT_STATE.willCommit;
            this._deferred = Q.defer();

            this.message = message || this.message;
            _commit();
        }
        return this._deferred.promise;
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

