var PackageManagerTools = require("../../../package-manager/package-manager-tools");

describe("package-tools", function () {

    describe("name validation", function () {

        it("should not begin with a dot or an underscore", function() {

            expect(PackageManagerTools.isPackageNameValid('_hello_world')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('.hello_world')).toEqual(false);
        });

        it("should not be node or js", function() {

            expect(PackageManagerTools.isPackageNameValid('node')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('NODE')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('NoDe')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('JS')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('js')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('leet')).toEqual(true);
        });

        it("can contains these characters: _ - . ~", function() {

            expect(PackageManagerTools.isPackageNameValid('hello_world___')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('mike--')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('benoit.marchant..')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('~francois~~')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('a-~_.b--~~_..')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('a!#@+=')).toEqual(false);
        });

        it("can contains number", function() {

            expect(PackageManagerTools.isPackageNameValid('hello_world_42')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('13h37')).toEqual(true);
            expect(PackageManagerTools.isPackageNameValid('v1.2.3')).toEqual(true);
        });

        it("should have at least one character", function() {

            expect(PackageManagerTools.isPackageNameValid('')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('a')).toEqual(true);
        });

        it("should contains just characters from the Unicode block (Basic Latin)", function() {

            expect(PackageManagerTools.isPackageNameValid('jean-françois')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('你好')).toEqual(false);
            expect(PackageManagerTools.isPackageNameValid('€')).toEqual(false);
        });

    });

    describe("version validation", function () {

        it("should respect at least the following format: [number].[number].[number]", function() {

            expect(PackageManagerTools.isVersionValid('1.2.3')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('1.2.x')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('1.2')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('1.')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('1')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('x.x.x')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('a.b.c')).toEqual(false);
        });

        it("can begin with the character v", function() {

            expect(PackageManagerTools.isVersionValid('v1.2.3')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('t1.2.3')).toEqual(false);
        });

        it("can have a valid tag", function() {

            expect(PackageManagerTools.isVersionValid('v1.2.3-alpha')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('v1.2.3-pre-')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('v1.2.3-pre-release')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('v1.2.3-hello')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('v1.2.3+alpha')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('v1.2.3-alpha$%')).toEqual(false);
            expect(PackageManagerTools.isVersionValid('v1.2.3-1')).toEqual(true);
            expect(PackageManagerTools.isVersionValid('v1.2.3-1-pre-release')).toEqual(true);
        });

    });

    describe("request format", function () {

        it("should respect the following format: name[@version]", function() {

            expect(PackageManagerTools.isRequestValid('montage@1.2.3')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('montage@1.2.')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('montage@')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('montage@@')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('montage@montage')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('montage@1.2.3@montage')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('montage')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('   ')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('  montage@1.2.3 ')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('@')).toEqual(false);
            expect(PackageManagerTools.isRequestValid(42)).toEqual(false);
        });

        it("should accept valid git urls.", function() {

            expect(PackageManagerTools.isRequestValid('git://git@github.com:declarativ/palette.git')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('git+ssh://git@github.com:declarativ/palette.git')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('git+ssh://git@github.com:declarativ/.git')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('git+http://github.com:declarativ/palette.git')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('git+https://git@github.com:declarativ/palette.git#445')).toEqual(true);
            expect(PackageManagerTools.isRequestValid('git+ftp://git@github.com:declarativ/palette.git')).toEqual(false);
            expect(PackageManagerTools.isRequestValid('git://git@github.com:declarativ/palette.git#93930#')).toEqual(false);
        });

    });

    describe("getting a Module Object", function () {

        it("from the following format: name[@version].", function() {
            var montage = PackageManagerTools.getModuleFromString('montage@1.2.3'),
                filament = PackageManagerTools.getModuleFromString('filament@'),
                wrongModuleName = PackageManagerTools.getModuleFromString('.filament@1.2.3'),
                emptyModule = PackageManagerTools.getModuleFromString('@'),
                falselyModule = PackageManagerTools.getModuleFromString(45);

            expect(montage.name).toEqual('montage');
            expect(montage.version).toEqual('1.2.3');

            expect(filament.name).toEqual('filament');
            expect(filament.version).toBeNull();

            expect(emptyModule.name).toBeNull();
            expect(emptyModule.version).toBeNull();

            expect(falselyModule).toBeNull();

            expect(wrongModuleName.name).toBeNull();
            expect(wrongModuleName.version).toBeNull();
        });

    });

    describe("person object formatting", function () {

        it("should convert a string that respect the following format: 'name <email> (url)' into an Person Object", function() {
            var person = PackageManagerTools.formatPersonFromString('pierre frisch <pierre.frisch@declarativ.com> (montage.com)');

            expect(person.name).toEqual('pierre frisch');
            expect(person.email).toEqual('pierre.frisch@declarativ.com');
            expect(person.url).toEqual('montage.com');
        });

    });

    describe("person containers", function () {
        var containerArray;

        beforeEach(function() {
            containerArray = [
                'bob <bob@declarativ.com> (declarativ.com)',
                {
                    name: 'bob',
                    email: 'bob@declarativ.com',
                    url: 'declarativ.com'
                },
                9
            ];
        });

        it("should format correctly a set of persons", function() {
            var containerFormatted = PackageManagerTools.formatPersonsContainer(containerArray);

            for (var i = 0, length = containerFormatted.length; i < length; i++) {
                expect(containerFormatted[0].name).toEqual('bob');
                expect(containerFormatted[0].email).toEqual('bob@declarativ.com');
                expect(containerFormatted[0].url).toEqual('declarativ.com');
            }
        });

    });

});
