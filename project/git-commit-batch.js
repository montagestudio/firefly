const Q = require("q");

module.exports = GitCommitBatchFactory;

function GitCommitBatchFactory(repositoryService) {
    const _repositoryService = repositoryService,
        _commitBatches = [];            // List of all pending batches

    const BATCH_COMMIT_STATE = {
        open: 1,
        willCommit: 2,
        committed: 3,
        done: 4
    };

    async function _commitBatch(batch) {
        batch._state = BATCH_COMMIT_STATE.committed;
        try {
            const result = await _repositoryService.commitBatch(batch)
            batch._state = BATCH_COMMIT_STATE.done;
            batch._deferred.resolve(result);
        } catch (error) {
            batch._state = BATCH_COMMIT_STATE.done;
            batch._deferred.reject(error);
        } finally {
            // Release the batch now that we are done with it
            batch.release();
        }
    }

    const _commit = async () => _commitBatches.some((batch) => {
        if (batch._state === BATCH_COMMIT_STATE.willCommit) {
            _commitBatch(batch);
        }
        return true;
    });

    class GitCommitBatch {
        constructor(message) {
            this.message = message;

            this._addedFiles = [];
            this._removedFiles = [];
            this._state = BATCH_COMMIT_STATE.open;
            this._deferred = null;

            // Insert the new batch at the end of the pending batches
            _commitBatches.push(this);
        }

        stageFiles(files) {
            if (Array.isArray(files)) {
                this._addedFiles.push.apply(this._addedFiles, files);
            } else {
                this._addedFiles.push(files);
            }
        }

        stageFilesForDeletion(files) {
            if (Array.isArray(files)) {
                this._removedFiles.push.apply(this._removedFiles, files);
            } else {
                this._removedFiles.push(files);
            }
        }

        release() {
            var pos = _commitBatches.indexOf(this);
            if (pos !== -1) {
                _commitBatches.splice(_commitBatches.indexOf(this), 1);
                // note: right now, we are not able to cancel the git commit if it has already started!
            }
            // Jump start any pending commit...
            _commit();
        }

        commit(message) {
            if (!this._deferred) {
                this._state = BATCH_COMMIT_STATE.willCommit;
                this._deferred = Q.defer();

                this.message = message || this.message;
                _commit();
            }
            return this._deferred.promise;
        }
    }

    /**
     * For debugging and testing purpose only
     * @private
     */
    GitCommitBatchFactory._batches = function() {
        return _commitBatches;
    };

    return GitCommitBatch;
}

