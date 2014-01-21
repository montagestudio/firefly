/* jshint camelcase: false */

var joey = require('joey'),

    searchConfig = {
        host: 'npmjs.org',
        port: '9200',
        path: '/npm/package/_search',
        maxResult : 300
    };

module.exports = function searchPackages (packages) {

    function _search () {
        var payload = {
            fields : [
                'name',
                'description',
                'author',
                'version',
                'repository',
                'homepage',
                'license'
            ],
            query : {
                multi_match : {
                    query : packages,
                    fields : ['name^4', 'keywords', 'description', 'readme']
                }
            },
            sort : ['_score'],
            size: searchConfig.maxResult
        };

        return _request(payload).then(function (response) {
            if (response.status !== 200) {
                //Todo improve this error message
                throw new Error("Error HTTP status code: " + response.statusCode);
            }

            return response.body.read().then(JSON.parse).then(_formatResultSearchRequest);
        });
    }

    function _request (payload) {
        var payloadJSON = JSON.stringify(payload),

            options = {
                host: searchConfig.host,
                port: searchConfig.port,
                method: 'POST',
                path: searchConfig.path,
                charset: 'utf8',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payloadJSON.length
                },
                body: [payloadJSON]
            },
            request = joey.client();

        return request(options);
    }

    function _formatResultSearchRequest(resultSearch) {
        var results = [];

        if (resultSearch && typeof resultSearch === "object" && typeof resultSearch.hits === "object") {
            var packageList = resultSearch.hits.hits;

            if (packageList) {
                packageList.forEach(function (packageInformation) {
                    if (packageInformation._type === "package") {
                        var fields = packageInformation.fields;

                        results.push({
                            name: fields.name,
                            version: fields.version,
                            author: fields.author,
                            description: fields.description,
                            license: fields.license,
                            homepage: fields.homepage
                        });
                    }
                });
            }
        }

        return results;
    }

    return _search();
};
