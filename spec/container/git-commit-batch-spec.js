var Promise = require("bluebird");
var GitCommitBatchFactory = require("../../container/git-commit-batch");

describe("Git Commit Batch", function () {
    var GitCommitBatch = GitCommitBatchFactory({
        commitBatch : function() {
            return Promise.resolve({success: true});
        }
    });

    var batchA, batchB, batchC, batchD;


    it("open 4 batches", function(done) {
        batchA = new GitCommitBatch("a");
        batchB = new GitCommitBatch("b");
        batchC = new GitCommitBatch("c");
        batchD = new GitCommitBatch();      // commit message will be set later

        expect(GitCommitBatchFactory._batches().length).toBe(4);
        done();
    });

    it("can stage a single file", function(done) {
        batchA.stageFiles("a.txt");
        expect(GitCommitBatchFactory._batches()[0]._addedFiles.length).toBe(1);
        done();
    });

    it("can stage multiple files", function(done) {
        batchB.stageFiles(["b1.txt", "b2.txt"]);
        expect(GitCommitBatchFactory._batches()[1]._addedFiles.length).toBe(2);
        done();
    });

    it("can stage a single file for deletion", function(done) {
        batchC.stageFilesForDeletion("c.txt");
        expect(GitCommitBatchFactory._batches()[2]._removedFiles.length).toBe(1);
        done();
    });

    it("can stage multiple files for deletion", function(done) {
        batchD.stageFilesForDeletion(["d1.txt", "d2.txt"]);
        batchD.message = "d";
        expect(GitCommitBatchFactory._batches()[3]._removedFiles.length).toBe(2);
        done();
    });

    it("can release a batch", function(done) {
        batchC.release();
        expect(GitCommitBatchFactory._batches().length).toBe(3);
        done();
    });

    it("commits batches in order", function(done) {
        var commitOrder = [];

        Promise.all([
            batchB.commit().then(function() {
                commitOrder.push(batchB.message);
            }),
            batchA.commit().then(function() {
                commitOrder.push(batchA.message);
            }),
            batchD.commit().then(function() {
                commitOrder.push(batchD.message);
            })
        ])
        .then(function() {
            expect(commitOrder.length).toBe(3);
            expect(commitOrder[0]).toBe("a");
            expect(commitOrder[1]).toBe("b");
            expect(commitOrder[2]).toBe("d");
        })
        .then(done, done);
    });

    it("queue is empty after every batches have been committed", function(done) {
        expect(GitCommitBatchFactory._batches().length).toBe(0);
        done();
    });
});
