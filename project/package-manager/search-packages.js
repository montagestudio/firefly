const joey = require('joey'),
    url = require("url"),
    htmlparser = require("htmlparser2"),

    searchConfig = {
        host: 'www.npmjs.com',
        ssl: true,
        method: 'GET',
        path: "/search?q=",
        charset: 'utf8'
    };

module.exports = function searchPackages(packages) {
    async function _search () {
        const options = {
                host: searchConfig.host,
                ssl: searchConfig.ssl,
                method: searchConfig.method,
                charset: searchConfig.charset,
                path: searchConfig.path + url.format(packages)
            },
            request = joey.client();

        const response = await request(options);
        if (response.status !== 200) {
            //Todo improve this error message
            throw new Error("Error HTTP status code: " + response.status);
        }
        return response.body.read().then(_formatResultSearchRequest);
    }

    function _formatResultSearchRequest(resultSearch) {
        let inResultEntry = false,
            inName = false,
            inDescription = false,
            inVersion = false,
            results = [];
        const parser = new htmlparser.Parser({
            onopentag(name, attrs) {
                if (attrs.class === 'package-details') {
                    inResultEntry = true;
                    results.push({});
                } else if(inResultEntry) {
                    if (attrs.class === 'name') {
                        inName = true;
                    } else if (attrs.class === 'description') {
                        inDescription = true;
                    } else if (attrs.class === 'version') {
                        inVersion = true;
                    }
                }
            },

            ontext(text) {
                if (inResultEntry) {
                    const curResult = results[results.length - 1];
                    if (inName) {
                        curResult.name = text.trim();
                    } else if (inDescription) {
                        curResult.description = text.trim();
                    } else if(inVersion) {
                        curResult.version = /([0-9]+\.[0-9]+\.[0-9]+)/.exec(text)[0];
                    }
                }
            },

            onclosetag(name) {
                if (inResultEntry) {
                    if (inName) {
                        inName = false;
                    } else if (inDescription) {
                        inDescription = false;
                    } else if (inVersion) {
                        inVersion = false;
                    } else if (name === 'div') {
                        inResultEntry = false;
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
