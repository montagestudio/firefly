var FileService = require('./file-service'),
    exec = require("../common/exec"),
    PATH = require("path"),
    Q = require("q"),

    OUT_PUT_EXTENSION = {
        BUNDLE: ".glTF",
        GlTF: ".json"
    };

module.exports = AssetConverterService;

function AssetConverterService (config, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {},
        convertPathToProjectUrl = FileService.makeConvertPathToProjectUrl(pathname, config.subdomain, environment),
        convertProjectUrlToPath = FileService.makeConvertProjectUrlToPath(pathname);

    function _isColladaFile (path) {
        return (/\.dae$/i).test(path);
    }

    function _getColladaOutPutPath (filename, path, isBundle) {
        var outputPath = null,
            extension = isBundle ? OUT_PUT_EXTENSION.BUNDLE : OUT_PUT_EXTENSION.GlTF;

        if (_isColladaFile(path)) { // replace dae extension by json
            outputPath = path.replace(/.dae$/, extension);
        } else if (/\.json$/i.test(path)) { // already valid
            outputPath = isBundle ? path.replace(/.json$/i, OUT_PUT_EXTENSION.BUNDLE) : path;
        } else {
            if (path.charAt(path.length-1) !== "/") { // name and extension missing
                outputPath = path + extension;
            } else {
                outputPath = PATH.join(path, filename + extension); // extension missing
            }
        }

        return outputPath;
    }

    function _convertToGlTF (inputPath, outputPath, bundle) {
        inputPath = PATH.join(fsPath, inputPath);
        outputPath = PATH.join(fsPath, outputPath);
        var configPath = PATH.join(__dirname, "collada2gltf-config.json");

        return exec("collada2gltf", ["-f", inputPath, !!bundle ? "-b" : "-o", outputPath, "-z", configPath], fsPath);
    }

    /**
     * Converts COLLADA file to glTF assets
     * @param  {string} url of the COLLADA file
     * @param  {Object} option set of options for the converter.
     * @param  {Object.boolean} option.bundle defines if a bundle is required.
     * @param  {Object.string} option.output defines the glTF output file.
     * @return {Promise} for the glTF file
     */
    service.convertColladaAtUrl = function (url, option) {
        var modelPath = convertProjectUrlToPath(url);

        if (_isColladaFile(modelPath)) {
            var isBundle = false,
                fileName = /(.*)\.dae$/i.exec(PATH.basename(modelPath))[1],
                outputPath = modelPath;

            if (option && typeof option === "object") {
                isBundle = !!option.bundle;

                if (typeof option.output === "string") {
                    outputPath = convertProjectUrlToPath(option.output);
                }
            }

            outputPath = _getColladaOutPutPath(fileName, outputPath, isBundle);

            return _convertToGlTF(modelPath, outputPath, isBundle).then(function () {
                return convertPathToProjectUrl(outputPath, environment);
            });
        }

        return Q.reject(new Error("the given file at: " + modelPath + " is not a collada file"));
    };

    return service;
}
