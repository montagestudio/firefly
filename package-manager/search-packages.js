/* jshint camelcase: false */

var request = require('request'),
    Q = require('q'),

    searchConfig = {
        url: "http://npmjs.org:9200/npm/package/_search",
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

        return Q.ninvoke(request, "get", {
            url : searchConfig.url,
            json: payload
        }).then(function (data) {
            var response = data[0],
                body = data[1];

            if (response.statusCode === 200) {
                return _formatResultSearchRequest(body);
            }

            //Todo improve this error message
            throw new Error("Error HTTP status code: " + response.statusCode);
        });
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
