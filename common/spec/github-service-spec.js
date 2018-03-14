var rewire = require("rewire");
var GithubServiceModule = rewire("../github-service"),
    GithubService = GithubServiceModule.GithubService;

describe("github-service-spec", function() {

    describe("initialization", function() {
        it("should create a Github API client using correct version and defined user-agent header", function(done) {
            var GithubApiMock = function (config) {
                this.config = config;
                this.authenticate = function() {};
            };
            GithubServiceModule.__set__('GithubApi', GithubApiMock);

            var service = new GithubService('42');

            expect(service._githubApi.config.version).toEqual('3.0.0');
            expect(service._githubApi.config.headers['user-agent']).toEqual('MontageStudio.com');
            done();
        });

        it("should configure Github API client to use oauth and given token", function(done) {
            var GithubApiMock = function () {
                this.authConfig = null;

                this.authenticate = function (authConfig) {
                    this.authConfig = authConfig;
                };
            };
            GithubServiceModule.__set__('GithubApi', GithubApiMock);

            var service = new GithubService('42');

            expect(service._githubApi.authConfig.type).toEqual('oauth');
            expect(service._githubApi.authConfig.token).toEqual('42');
            done();
        });
    });

    describe("get repository", function() {
        it("should return a promise that resolve to repository info", function(done) {
            var GithubApiMock = function () {
                this.authenticate = function () {};

                this.repos = {};
                this.repos.get = function(config, callback) {
                    callback(null, {
                        owner: config.user,
                        repo: config.repo,
                        anotherField: 'baz'
                    });
                };
            };
            GithubServiceModule.__set__('GithubApi', GithubApiMock);
            var service = new GithubService('42');

            service.getRepo('foo', 'bar')
                .then(function(data) {
                    expect(data.owner).toEqual('foo');
                    expect(data.repo).toEqual('bar');
                    expect(data.anotherField).toEqual('baz');
                    done();
                });
        });

    });

    describe('get organizations', function() {
        it('should return a promise that resolve to organization list', function(done) {
            var providedUsername,
                GithubApiMock = function () {
                this.authenticate = function () {};

                this.orgs = {
                    getFromUser: function(username, callback) {
                        providedUsername = username.user;
                        callback(null, [
                            {login: 'foo', id: 1},
                            {login: 'bar', id: 233}
                        ]);
                    }
                };
            };
            GithubServiceModule.__set__('GithubApi', GithubApiMock);
            var service = new GithubService('42');

            service.getOrganizations('BAZ')
                .then(function(organizations) {
                    expect(providedUsername).toBeDefined();
                    expect(providedUsername).toEqual('BAZ');
                    expect(organizations).not.toBeNull();
                    expect(organizations.length).toEqual(2);
                    var organization0 = organizations[0];
                    expect(organization0.login).toEqual('foo');
                    expect(organization0.id).toEqual(1);
                    var organization1 = organizations[1];
                    expect(organization1.login).toEqual('bar');
                    expect(organization1.id).toEqual(233);
                })
                .finally(done);
        });
    });
});
