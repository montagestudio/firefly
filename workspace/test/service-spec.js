const { expect } = require('chai');
const path = require('path');
const grpc = require('grpc');
const rimraf = require('rimraf');
const makeServer = require('../src/server');
const makeFakeWorkspaces = require('./make-fake-workspaces');

const TMP_PATH = path.join(__dirname, '.tmp');
const PROTO_PATH = path.join(__dirname, '..', 'src', 'service.proto');

const service = grpc.load(PROTO_PATH);

const fakeTree = {
    'user1': {
        'owner1': {
            'repo1': {},
            'repo2': {}
        },
        'owner2': {
            'repo1': {}
        }
    },
    'user2': {
        'owner1': {
            'repo1': {}
        }
    }
};

describe('service', () => {
    let server;
    let client;

    before(() => {
        server = makeServer(TMP_PATH);
        server.bind('0.0.0.0:50001', grpc.ServerCredentials.createInsecure());
        server.start();
    });

    after(() => {
        server.forceShutdown();
    });

    beforeEach(() => {
        makeFakeWorkspaces(TMP_PATH, fakeTree);
        client = new service.Workspace('localhost:50001', grpc.credentials.createInsecure());
    });

    afterEach((done) => {
        rimraf(TMP_PATH, e => done(e));
    });

    describe('GetWorkspace', () => {
        it('gets an existing workspace', (done) => {
            client.getWorkspace({
                user: { name: 'user1' },
                owner: 'owner1',
                repo: 'repo2'
            }, (err) => {
                expect(err).to.be.null;
                done();
            });
        });

        it('returns an error for a nonexistent workspace', (done) => {
            client.getWorkspace({
                user: { name: 'user1' },
                owner: 'owner2',
                repo: 'repo3'
            }, (err) => {
                expect(err).not.to.be.null;
                done();
            });
        });
    });

    describe('ListWorkspaces', () => {
        it('lists a user\'s workspaces', (done) => {
            const call = client.listWorkspaces({ name: 'user1' });
            let workspaceCount = 0;
            call.on('data', () => { workspaceCount++ });
            call.on('end', () => {
                expect(workspaceCount).to.equal(3);
                done();
            });
        });
    });

    describe('DeleteWorkspaces', () => {
        it('deletes a user\'s workspaces', (done) => {
            client.deleteWorkspaces({ name: 'user1' }, (err) => {
                expect(err).to.be.null;
                const listCall = client.listWorkspaces({ name: 'user1' });
                let workspaceCount = 0;
                listCall.on('data', () => { workspaceCount++; });
                listCall.on('end', () => {
                    expect(workspaceCount).to.equal(0);
                    done();
                });
            });
        });
    });
});
