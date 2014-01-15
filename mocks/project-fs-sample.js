/* jshint maxcomplexity:false */

var ProjectFSMocksFactory = require('./project-fs-factory'),
    QFSMock = require("q-io/fs-mock"),
    DEFAULT_PROJECT_NAME = 'project-fs-sample';

module.exports = function ProjectFSSample (name, error) {

    return QFSMock(ProjectFSMocksFactory({
        name: name || DEFAULT_PROJECT_NAME,
        version: '0.1.0',
        dependencies: [
            {
                name: 'digit',
                version: '0.0.1',
                missing: !!error ? error : false
            },
            {
                name: 'filament',
                version: '0.0.3',
                extraneous: !!error ? error : false,
                dependencies: [
                    {
                        name: 'npm',
                        version: '0.3.4'
                    }
                ]
            },
            {
                name: 'montage',
                version: '0.13.0',
                dependencies: [
                    {
                        name: 'joey',
                        version: '0.1.2',
                        dependencies: [
                            {
                                name: 'filament',
                                version: '0.0.3',
                                missing: true,
                                invalid: !!error ? error : false
                            },
                            {
                                name: 'q',
                                version: '0.9.0',
                                missing: true
                            },
                            {
                                name: 'zip',
                                version: '0.0.3',
                                missing: !!error ? error : false
                            }
                        ]
                    }
                ],
                invalid: !!error ? error : false
            },
            {
                name: 'zip',
                version: '1.1.1',
                extraneous: true
            },
            {
                name: 'zy',
                version: '1.1.1',
                jsonFileMissing: !!error ? error : false
            },
            {
                name: 'zx',
                version: '1.1.1',
                jsonFileError: !!error ? error : false
            }
        ],
        optionalDependencies: [
            {
                name: 'montage-testing',
                version: '0.0.3',
                invalid: !!error ? error : false,
                devDependencies:[
                    {
                        name: 'native',
                        version: '0.1.1'
                    }
                ]
            },
            {
                name: 'sip',
                version: '0.9.0',
                missing: true
            },
            {
                name: 'q',
                version: '0.9.0',
                missing: !!error ? error : false
            }
        ],
        devDependencies: [
            {
                name: 'underscore',
                version: '0.2.3',
                dependencies: [],
                missing: true
            },
            {
                name: 'native',
                version: '0.2.3',
                invalid: !!error ? error : false,
                dependencies: []
            }
        ],
        bundledDependencies: [
            'underscore',
            'montage',
            'zip'
        ]
    }));

};
