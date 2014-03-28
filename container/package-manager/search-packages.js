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
                path: searchConfig.path + url.format(packages)
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
            version = true,
            results = [],
            curResult = null,
            openLiCount = 0;

        var parser = new htmlparser.Parser({
            onopentag: function (name, attribs) {
                if (curResult) {
                    if (name === "li") {
                        openLiCount++;
                    }

                    if (name === "a" && /^\/package\//.test(attribs.href)) {
                        curResult.name = attribs.title;

                    } else if (name === "div" && attribs.class === "details") {
                        details = true;

                    } else if (name === "p" && attribs.class === "description") {
                        description = true;

                    } else if (name === "span" && attribs.class === "version") {
                        version = true;
                    }
                }

                if (name === "li" && attribs.class === "search-result package") {
                    openLiCount++;
                    curResult = {};
                }
            },
            ontext: function (text) {
                text = text.trim();

                if (curResult) {
                    if (description) {
                        curResult.description = text;
                        description = false;

                    } else if (curResult.version && details && text.length > 0) {
                        curResult.author = text.trim();

                    } else if (version && text.length > 0 && /([0-9]+\.[0-9]+\.[0-9]+)/.test(text)) {
                        curResult.version = /([0-9]+\.[0-9]+\.[0-9]+)/.exec(text)[0];
                    }
                }
            },
            onclosetag: function (tagname) {
                if (curResult) {
                    if (tagname === "li") {
                        openLiCount--;

                        if (openLiCount === 0) {
                            results.push(curResult);
                            curResult = null;
                        }
                    } else if (tagname === "p" && details) {
                        details = false;
                    }
                }
            }
        });

        parser.write(resultSearch);
        parser.end();

        return results;
    }

    return _search();
};
