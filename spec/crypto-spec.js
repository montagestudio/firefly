var cryptoService = require("../crypto-service")("secret-key");

describe("cryptoService", function () {
    var data;
    beforeEach(function () {
        data = "Hello FireFly!";
    });

    it("encrypts and decrypts data", function () {
        var encryptedData = cryptoService.encryptData(data);
        expect(typeof encryptedData).toEqual("string");
        expect(encryptedData).not.toEqual(data);

        var decryptedData = cryptoService.decryptData(encryptedData);
        expect(decryptedData).toEqual(data);
    });
});
