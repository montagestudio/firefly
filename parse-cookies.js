var Cookie = require("q-io/http-cookie");

module.exports = parseCookies;
function parseCookies(request) {
    request.cookies = {};
    if (!request.headers.cookie) {
        return;
    }

    if (!Array.isArray(request.headers.cookie)) {
        request.headers.cookie = [request.headers.cookie];
    }

    var requestHost = ipRe.test(request.headers.host) ?
        request.headers.host :
        "." + request.headers.host;

    request.headers.cookie.forEach(function (cookie) {
        var date = request.headers.date ?
            new Date(request.headers.date) :
            new Date();
        cookie = Cookie.parse(cookie, date);
        // ignore illegal host
        if (cookie.host && !hostContains(requestHost, cookie.host)) {
            delete cookie.host;
        }
        request.cookies[cookie.key] = cookie.value;
    });
}

var ipRe = /^\d+\.\d+\.\d+\.\d+$/;

function hostContains(container, content) {
    if (ipRe.test(container) || ipRe.test(content)) {
        return container === content;
    } else if (/^\./.test(container)) {
        return (
            content.lastIndexOf(container) ===
            content.length - container.length
        ) || (
            container.slice(1) === content
        );
    } else {
        return container === content;
    }
}
