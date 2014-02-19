var PackageManagerTools = {};

/**
 * Checks if a package name is valid.
 * @function
 * @param {String} name
 * @param {Boolean} strict
 * @return {Boolean}
 */
PackageManagerTools.isPackageNameValid = function (name, strict) {
    if (typeof strict === "undefined" || strict) {
        return typeof name === 'string' ?
            (/^(?!(js|node|node_modules|favicon\.ico)$)(?=([0-9a-zA-Z~]([\w\-\.~]){0,})$)/i).test(name) : false;
    }

    return typeof name === 'string' ? /^[0-9a-zA-Z~]([\w\-\.~])*$/.test(name) : false;
};

/**
 * Checks if a package version is valid.
 * @function
 * @param {String} version
 * @return {Boolean}
 */
PackageManagerTools.isVersionValid = function (version) {
    return typeof version === 'string' ? (/^v?([0-9]+\.){2}[0-9]+(\-?[a-zA-Z0-9])*$/).test(version) : false;

};

/**
 * Checks if a string is a Git url.
 * @function
 * @param {String} url.
 * @return {Boolean}
 */
PackageManagerTools.isGitUrl = function (url) {
    return typeof url === 'string' ?
        (/^git(\+https?|\+ssh)?:\/\/([\w\-\.~]+@)?[\/\w\.\-:~\?]*\/([0-9a-zA-Z~][\w\-\.~]*)\.git(#[\w\-\.~]*)?$/).exec(url) : false;
};

/**
 * Checks if a string respects the following format: "name[@version]" or a Git url.
 * @function
 * @param {String} request the dependency name to search.
 * @return {Boolean}
 */
PackageManagerTools.isRequestValid = function (request) {
    if (this.isGitUrl(request)) { // Case: Git url
        return true;
    }

    if (typeof request === 'string' && request.length > 0) { // Case: name[@version]
        var data = request.split('@'),
            name = data[0],
            version = data[1];

        /*
         * Verification:
         *
         * - No extra data.
         * - Valid name.
         * - Version is optional, but if exists should be valid.
         *
         */

        return data.length > 0 && data.length < 3 && PackageManagerTools.isPackageNameValid(name, false) &&
            (typeof version === "undefined" || (typeof version !== "undefined" && this.isVersionValid(version)));
    }

    return false;
};

/**
 * Returns a Object Module  with its name and eventually its version from a string
 * respecting the following format "name[@version]".
 * @function
 * @param {String} string.
 * @return {Object} An Object Module .
 */
PackageManagerTools.getModuleFromString = function (string) {
    if (typeof string === 'string' && string.length > 0) {
        var module = {},
            tmp = string.trim().split('@'),
            name = tmp[0],
            version = tmp[1];

        module.name = this.isPackageNameValid(name, false) ? name : null;
        module.version = this.isVersionValid(version) && module.name ? version : null;

        return module;
    }
    return null;
};

/**
 * Formats a string which respects the following format "name <mail> (url).
 * @function
 * @param {String} string.
 * @return {Object|null} A Person Object.
 */
PackageManagerTools.formatPersonFromString = function (string) {
    var person = null;

    if (typeof string === "string" && string.length > 0) {
        /*
         * \u0020 => space unicode.
         * \u00A1 (Latin-1 Supplement) to \uFFFF (Specials).
         */

        var personName = (/([\w\-\.\u0020\u00A1-\uFFFF]+)/).exec(string);

        if (personName) {
            var personEmail = (/<(.+)>/).exec(string),
                personUrl = (/\((.+)\)/).exec(string);

            person = {
                name: personName[1].trim(),
                email: personEmail ? personEmail[1] : '',
                url: personUrl ? personUrl[1] : ''
            };
        }
    }
    return person;
};

/**
 * Formats a string which respects the following format "name <mail> (url)",
 * or an object which contains several strings respecting the above format.
 * @function
 * @param {String|Object} personsContainer a Person Objects container or a string.
 * @return {Array} array of Person Objects.
 */
PackageManagerTools.formatPersonsContainer = function (personsContainer) {
    var persons = [];

    if (personsContainer && typeof personsContainer === "object") { // Contains several Person Objects or Strings.
        var self = this,
            personsKeys = Object.keys(personsContainer);

        personsKeys.forEach(function (personKey) {
            var person = personsContainer[personKey];

            if (typeof person === "string") { // Need to be parse into an Person Object.
                person = self.formatPersonFromString(person);

                if (person && typeof person === "object") {
                    persons.push(person);
                }
            } else if (person && typeof person === "object" && person.hasOwnProperty('name')) { // Already an Person Object.
                persons.push({
                    name: person.name,
                    email: person.email || '',
                    url: person.url|| ''
                });
            }
        });
    } else if (typeof personsContainer === "string") {
        var person = this.formatPersonFromString(personsContainer);
        persons = person ? [person] : [];
    }

    return persons;
};

module.exports = PackageManagerTools;
