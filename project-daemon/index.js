const log = require('logging').from(__filename);

/* Catch possible hidden error */
process.on('uncaughtException', function (err) {
  log('*uncaughtException*', err, err.stack);
});

const projectChainFactory = require('./chain');

const ContainerManager = require('./container-manager');
const axios = require('axios');

const Dockerode = require('dockerode');

const commandOptions = {
    port: {
        alias: 'p',
        describe: 'The port to run the app server on',
        default: process.env.FIREFLY_PORT
    },
    'mount-workspaces': {
        describe: 'Set to mount the container workspaces on the host',
        default: false
    },
    help: {
        describe: 'Show this help'
    }
};

module.exports = async (options) => {
    log('env', process.env.NODE_ENV);
    log('port', process.env.FIREFLY_PORT);
    log('app', process.env.FIREFLY_APP_URL);
    log('project', process.env.FIREFLY_PROJECT_URL);

    const docker  = new Dockerode({socketPath: '/var/run/docker.sock'});

    const projectChain = projectChainFactory({
        containerManager: new ContainerManager(docker),
        request: axios
    });
    const server = await projectChain.listen(options.port);
    log('Listening on', process.env.FIREFLY_APP_URL);

    server.node.on('upgrade', projectChain.upgrade);

    // for naught
    if (process.send) {
        process.on('message', async (message) => {
            if (message === 'shutdown') {
                log('shutdown message from Naught');
                // TODO gracefully shutdown the websocket connections
                try {
                    await server.stop();
                } catch (error) {
                    global.console.error('Error shutting down', error.stack);
                    throw error;
                } finally {
                    log('goodbye.');
                    process.exit(0);
                }
            }
        });

        process.send('online');
    }
}

if (require.main === module) {
    const optimist = require('optimist');
    const argv = optimist
        .usage('Usage: $0 [--port=<port>]')
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    module.exports(argv).done();
}
