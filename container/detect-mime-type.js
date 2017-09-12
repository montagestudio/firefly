var mmm = require("mmmagic");
var Magic = mmm.Magic;
var htmlparser = require("htmlparser2");
var Promise = require("bluebird");
var PATH = require('path');

var Configuration = {

    mimeTypes: {

        APPLICATION_XML: {
            value: "application/xml",
            enabled: true
        },

        TEXT_HTML: {
            value: "text/html",
            enabled: true
        },

        TEXT_PLAIN: {
            value: "text/plain",
            enabled: true
        },

        INODE_DIRECTORY:  {
            value: "inode/directory",
            enabled: true
        },

        // List of mime types not supported by mmmagic.

        MONTAGE_TEMPLATE: {
            value: "text/montage-template",
            enabled: false
        },

        MONTAGE_SERIALIZATION: {
            value: "text/montage-template",
            enabled: false
        },

        COLLADA: {
            value: "model/vnd.collada+xml",
            enabled: true
        },

        GLTF: {
            value: "model/gltf",
            enabled: false
        },

        GLTF_BUNDLE: {
            value: "model/gltf-bundle",
            enabled: true
        }
    }
};

module.exports = exports = detectMimeType;
module.exports.mimeTypes = Configuration.mimeTypes;

function detectMimeType (fs, path, fsPath) {
    var magic = new Magic(mmm.MAGIC_MIME_TYPE),
        detectFile = Promise.promisify(magic.detectFile, {context: magic});
        fsFilePath = PATH.join(fsPath, path);

    return detectFile(fsFilePath).then(function (mimeType) {
        if (path.charAt(path.length - 1) === "/") { // remove last trailing slash.
            path = path.slice(0, -1);
        }

        var parts = path.split('/'),
            fileName = parts[parts.length - 1],
            supportedMimeTypes = Configuration.mimeTypes;

        mimeType = mimeType.toLowerCase();

        if (mimeType === supportedMimeTypes.APPLICATION_XML.value && supportedMimeTypes.COLLADA.enabled &&
            /\.dae$/i.test(fileName)) {

            return isColladaMimeType(fs, path).then(function (response) {
                return response ? supportedMimeTypes.COLLADA.value : mimeType;
            });

        } else if (mimeType === supportedMimeTypes.TEXT_HTML.value && supportedMimeTypes.MONTAGE_TEMPLATE.enabled &&
            /^(?!index\.html$)(?=(.+\.html)$)/i.test(fileName)) {

            return isMontageTemplateMimeType(fs, path).then(function (response) {
                return response ? supportedMimeTypes.MONTAGE_TEMPLATE.value : mimeType;
            });

        } else if (mimeType === supportedMimeTypes.TEXT_PLAIN.value && /^(?!package\.json)(?=(.+\.json)$)/i.test(fileName)) {

            if (supportedMimeTypes.MONTAGE_SERIALIZATION.enabled || supportedMimeTypes.GLTF.enabled) {

                return fs.read(path).then(JSON.parse).then(function (result) {
                    if (result) {
                        if (result.hasOwnProperty('owner') && supportedMimeTypes.MONTAGE_SERIALIZATION.enabled) { // montage-serialization
                            mimeType = supportedMimeTypes.MONTAGE_SERIALIZATION.value;

                        } else if (result.asset && result.asset.generator &&
                            /^collada2gltf/i.test(result.asset.generator) && supportedMimeTypes.GLTF.enabled) { // gltf json
                            //fixme support just the gltf files which have been generate by the collada2gltf converter

                            mimeType = supportedMimeTypes.GLTF.value ;
                        }
                    }

                    return mimeType;
                });
            }

        } else if (mimeType === supportedMimeTypes.INODE_DIRECTORY.value && supportedMimeTypes.GLTF_BUNDLE.enabled &&
            /\.gltf$/i.test(fileName)) {

            return supportedMimeTypes.GLTF_BUNDLE.value;
        }

        return mimeType;
    });
}

function isMontageTemplateMimeType (fs, path) {
    return fs.read(path, "r").then(function (content) {
        var isTemplate = false,
            montageSerializationMimeType = Configuration.mimeTypes.MONTAGE_SERIALIZATION.value,

            parser = new htmlparser.Parser({
                onopentag: function(tagName, attributes){
                    if (tagName === "script" && attributes.type.toLowerCase() === montageSerializationMimeType) {
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
