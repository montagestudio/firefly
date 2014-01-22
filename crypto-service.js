var log = require("logging").from(__filename);
var crypto = require('crypto');

var SAH_DEFAULT_SECRET = "dd5d8cafe37ee96fbc4115b950117725843651bc";
var SAH_BASED_IV = "77d60533620cb8a003b5d478d1dc";    // short by 2 bytes
var SAH_BASED_SALT = "ae565429beb1";                   // short by 2 bytes

module.exports = cryptoService;

function cryptoService(secret) {
    // Returned service
    var service = {};

    secret = secret || SAH_DEFAULT_SECRET;

    service.encryptData = function(data) {
        var iv = crypto.randomBytes(2),
            salt = crypto.randomBytes(2),
            key = crypto.pbkdf2Sync(secret, Buffer.concat([new Buffer(SAH_BASED_SALT, 'hex'), salt]), 10000, 16),
            cipher = crypto.createCipheriv('aes128', key, Buffer.concat([new Buffer(SAH_BASED_IV, 'hex'), iv])),
            result = "";

        result += iv.toString('hex');
        result += salt.toString('hex');
        result += cipher.update(data, 'utf8', 'hex');
        result += cipher.final('hex');

        return result;
    };

    service.decryptData = function(data) {
        var result;

        if (data.length > 8) {
            try {
                var iv = new Buffer(SAH_BASED_IV + data.slice(0, 4), 'hex'),
                    salt = new Buffer(SAH_BASED_SALT + data.slice(4, 8), 'hex'),
                    key = crypto.pbkdf2Sync(secret, salt, 10000, 16),
                    decipher = crypto.createDecipheriv('aes128', key, iv);

                result = decipher.update(data.slice(8), 'hex', 'utf8');
                result += decipher.final('utf8');

            } catch (error) {
                log("*decipher error*", error.stack);
                result = null;
            }
        }

        return result;
    };

    return service;
}
