var mmm = require("mmmagic");
var Magic = mmm.Magic;
var htmlparser = require("htmlparser2");
var Q = require("q");
var PATH = require('path');

module.exports = detectMimeType;

function detectMimeType (fs, path, fsPath) {
    var magic = new Magic(mmm.MAGIC_MIME_TYPE),
        fsFilePath = PATH.join(fsPath, path);

    return Q.ninvoke(magic, "detectFile", fsFilePath).then(function (mimeType) {
        var parts = path.split('/'),
            fileName = parts[parts.length - 1];

        if (mimeType === "application/xml" && /\.dae$/.test(fileName)) {

            return !!isColladaMimeType(fs, path) ? "model/vnd.collada+xml" : mimeType;

        } else if (mimeType === "text/html" && /^(?!index\.html$)(?=(.+\.html)$)/.test(fileName)) {

            return !!isMontageTemplateMimeType(fs, path) ? "text/montage-template" : mimeType;

        } else if (mimeType === "text/plain" && /^(?!package\.json)(?=(.+\.json)$)/.test(fileName)) {

            return isMontageSerializationMimeType(fs, path).then(function (isMontageSerialization) {
                return !!isMontageSerialization ? "text/montage-serialization" : mimeType;
            });
        }

        return mimeType;
    });
}


function isMontageSerializationMimeType (fs, path) {
    return fs.read(path).then(JSON.parse).then(function (result) {
        return result.hasOwnProperty('owner');
    });
}

function isMontageTemplateMimeType (fs, path) {
    return fs.read(path, "r").then(function (content) {
        var isTemplate = false,
            parser = new htmlparser.Parser({
                onopentag: function(tagName, attributes){
                    if (tagName === "script" && attributes.type === "text/montage-serialization") {
                        isTemplate = true;
                        parser.reset();
                    }
                }
            });

        parser.write(content);
        parser.end();

        return isTemplate;
    });
}

function isColladaMimeType (fs, path) {
    return fs.read(path, "r").then(function (content) {
        var isCollada = false,
            parser = new htmlparser.Parser({
                onopentagname: function(tagName){
                    isCollada = tagName === "collada";
                    parser.reset(); // collada must be the root element.
                }
            });

        parser.write(content);
        parser.end();

        return isCollada;
    });
}
