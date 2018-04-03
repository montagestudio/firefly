var jwt = require("jsonwebtoken");
var HttpApps = require("q-io/http-apps");

// TODO: Switch to JWK, use robust private key
var SECRET = "shhhh";

exports = module.exports = function (ok, notOk) {
    notOk = notOk || unauthorizedResponse;
    return function (request) {
        var token = request.headers["x-access-token"];
        if (!token) {
            return notOk(request);
        }
        return exports.verify(token)
            .then(function (payload) {
                request.githubUser = payload.githubUser;
                request.githubAccessToken = payload.githubAccessToken;
                return ok(request);
            }, function (err) {
                return notOk(request);
            });
    };
};

function unauthorizedResponse(request) {
    return HttpApps.responseForStatus(request, 401);
}

exports.sign = function (payload) {
    return new Promise(function (resolve, reject) {
        jwt.sign(payload, SECRET, {
            expiresIn: 60 * 60 * 60 * 24
        }, function (err, token) {
            if (err) {
                reject(err);
            } else {
                resolve(token);
            }
        });
    });
};

exports.verify = function (token) {
    return new Promise(function (resolve, reject) {
        jwt.verify(token, SECRET, function (err, payload) {
            if (err) {
                reject(err);
            } else {
                resolve(payload);
            }
        });
    });
};
