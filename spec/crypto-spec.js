var cryptoService = require("../crypto-service")("secret-key");

describe("cryptoService", function () {
    var _data = "Hello FireFly!",
        _encryptedData;

    it("encrypts data", function () {
        _encryptedData = cryptoService.encryptData(_data);
        expect(typeof _encryptedData).toEqual("string");
        expect(_encryptedData).not.toEqual(_data);
    });

    it("decrypts data", function () {
        var data = cryptoService.decryptData(_encryptedData);
        expect(data).toEqual(data);
    });
});
