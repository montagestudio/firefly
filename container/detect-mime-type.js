var mmm = require("mmmagic");
var Magic = mmm.Magic;
var htmlparser = require("htmlparser2");
var Q = require("q");
var PATH = require('path');

module.exports = exports = detectMimeType;

// List of mime types not supported by mmmagic.
var ADDITIONAL_MIME_TYPES = exports.ADDITIONAL_MIME_TYPES = {
    MONTAGE_TEMPLATE: "text/montage-template",
    MONTAGE_SERIALIZATION: "text/montage-serialization",
    COLLADA: "model/vnd.collada+xml",
    GLTF: "model/gltf",
    GLTF_BUNDLE: "model/gltf-bundle"
};

var LIB_MAGIC_MIME_TYPES = {
    APPLICATION_XML: "application/xml",
    TEXT_HTML: "text/html",
    TEXT_PLAIN: "text/plain",
    INODE_DIRECTORY: "inode/directory"
};

function detectMimeType (fs, path, fsPath) {
    var magic = new Magic(mmm.MAGIC_MIME_TYPE),
        fsFilePath = PATH.join(fsPath, path);

    return Q.ninvoke(magic, "detectFile", fsFilePath).then(function (mimeType) {
        var parts = path.split('/'),
            fileName = parts[parts.length - 1];

        mimeType = mimeType.toLowerCase();

        if (mimeType === LIB_MAGIC_MIME_TYPES.APPLICATION_XML && /\.dae$/.test(fileName)) {

            return !!isColladaMimeType(fs, path) ? ADDITIONAL_MIME_TYPES.COLLADA : mimeType;

        } else if (mimeType === LIB_MAGIC_MIME_TYPES.TEXT_HTML && /^(?!index\.html$)(?=(.+\.html)$)/.test(fileName)) {

            return !!isMontageTemplateMimeType(fs, path) ? ADDITIONAL_MIME_TYPES.MONTAGE_TEMPLATE : mimeType;

        } else if (mimeType === LIB_MAGIC_MIME_TYPES.TEXT_PLAIN && /^(?!package\.json)(?=(.+\.json)$)/.test(fileName)) {

            return fs.read(path).then(JSON.parse).then(function (result) {
                if (result) {
                    if (result.hasOwnProperty('owner')) { // montage-serialization
                        mimeType = ADDITIONAL_MIME_TYPES.MONTAGE_SERIALIZATION;
                    } else if (result.asset && result.asset.generator && /^collada2gltf/.test(result.asset.generator)) { // gltf json
                        //fixme support just the gltf files which have been generate by the collada2gltf converter

                        mimeType = ADDITIONAL_MIME_TYPES.GLTF ;
                    }
                }

                return mimeType;
            });
        } else if (mimeType === LIB_MAGIC_MIME_TYPES.INODE_DIRECTORY && PATH.extname(fileName) === ".glTF") {

            return ADDITIONAL_MIME_TYPES.GLTF_BUNDLE;
        }

        return mimeType;
    });
}

function isMontageTemplateMimeType (fs, path) {
    return fs.read(path, "r").then(function (content) {
        var isTemplate = false,
            parser = new htmlparser.Parser({
                onopentag: function(tagName, attributes){
                    if (tagName === "script" && attributes.type.toLowerCase() === ADDITIONAL_MIME_TYPES.MONTAGE_SERIALIZATION) {
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
