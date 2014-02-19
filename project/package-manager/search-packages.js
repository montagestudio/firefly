/* jshint camelcase: false */

var joey = require('joey'),
    url = require("url"),
    htmlparser = require("htmlparser2"),

    searchConfig = {
        host: 'www.npmjs.org',
        ssl: true,
        method: 'GET',
        path: "/search?q=",
        charset: 'utf8'
    };

module.exports = function searchPackages (packages) {

    function _search () {
        var options = {
                host: searchConfig.host,
                ssl: searchConfig.ssl,
                method: searchConfig.method,
                charset: searchConfig.charset,
                path: searchConfig.path + url.format(packages),
            },
            request = joey.client();

        return request(options).then(function (response) {
            if (response.status !== 200) {
                //Todo improve this error message
                throw new Error("Error HTTP status code: " + response.statusCode);
            }

            return response.body.read().then(_formatResultSearchRequest);
        });
    }

    function _formatResultSearchRequest(resultSearch) {
        var details = false,
            description = false,
            results = [],
            curResult = null;

        var parser = new htmlparser.Parser({
            onopentag: function (name, attribs) {
                if (name === "li" && attribs.class === "search-result package"){
                    curResult = {};

                } else if (curResult && name === "a" && /^\/package\//.test(attribs.href)) {
                    curResult.name = /^\/package\/(.+)/.exec(attribs.href)[1];

                } else if (curResult && name === "p" && attribs.class === "details") {
                    details = true;

                } else if (curResult && name === "p") {
                    description = true;
                }
            },
            ontext: function (text) {
                text = text.trim();

                if (curResult && description) {
                    curResult.description = text;
                    description = false;

                } else if (curResult && curResult.version && details && text.length > 0) {
                    curResult.author = text.trim();

                } else if (curResult && details && text.length > 0) {
                    curResult.version = /([0-9]+\.[0-9]+\.[0-9]+)/.exec(text)[0];
                }
            },
            onclosetag: function (tagname) {
                if (curResult && tagname === "li") {
                    results.push(curResult);
                    curResult = null;

                } else if (curResult && tagname === "p" && details) {
                    details = false;
                }
            }
        });

        parser.write(resultSearch);
        parser.end();

        return results;
    }

    return _search();
};
