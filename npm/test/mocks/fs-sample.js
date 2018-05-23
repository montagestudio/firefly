const fsFactory = require('./fs-factory');

const DEFAULT_PROJECT_NAME = 'project-fs-sample';

function fsSample(name, error) {
    return fsFactory({
        name: name || DEFAULT_PROJECT_NAME,
        version: '0.1.0',
        dependencies: [
            {
                name: 'digit',
                version: '0.0.1',
                missing: !!error
            },
            {
                name: 'filament',
                version: '0.0.3',
                extraneous: !!error,
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
                                invalid: !!error
                            },
                            {
                                name: 'q',
                                version: '0.9.0',
                                missing: true
                            },
                            {
                                name: 'zip',
                                version: '0.0.3',
                                missing: !!error
                            }
                        ]
                    }
                ],
                invalid: !!error
            },
            {
                name: 'zip',
                version: '1.1.1',
                extraneous: true
            },
            {
                name: 'zy',
                version: '1.1.1',
                jsonFileMissing: !!error
            },
            {
                name: 'zx',
                version: '1.1.1',
                jsonFileError: !!error
            }
        ],
        optionalDependencies: [
            {
                name: 'montage-testing',
                version: '0.0.3',
                invalid: !!error,
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
                missing: !!error
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
                invalid: !!error,
                dependencies: []
            }
        ],
        bundledDependencies: [
            'underscore',
            'montage',
            'zip'
        ]
    });
}
module.exports = fsSample;
