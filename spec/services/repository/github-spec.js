var rewire = require("rewire");
var GithubServiceModule = rewire("../../../services/repository/github"),
    GithubService = GithubServiceModule.GithubService;

describe("services/repository/github-spec", function() {
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
});
