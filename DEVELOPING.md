# Developing

## Compose files

Firefly is deployed using a composition of multiple docker compose files. The base file, `firefly-stack.yml`, contains the canonical definitions of every service. This file is then temporarily merged with an appropriate override file (`firefly-stack.dev.yml`, `firefly-stack.prod.yml`) that defines environment-specific configurations like ports and volumes.

In development, `firefly-stack.dev.yml` adds volumes to each service such that each service's source code is live synced to the running service. This way we do not need to run a Docker image build everytime a service's source code changes. If you change the source code of a service, use `docker service update --force <service_name>` to kill and recreate new tasks for the service with the updated code. The static service does not need to be updated (unless you change `nginx.conf`) because the changes to filament are synced automatically and will be available on the next browser refresh.

For a more nuclear options, use `npm restart` to remove all services from the stack and recreate them.

If you change the `Dockerfile` or dependencies in the `package.json` of any service you need to rebuild the image with `docker-compose -c firefly-stack.yml build <service_name>`.

## Services

Each service defines its own `Dockerfile`. Images are built by docker-compose through the `firefly-stack.yml` file, using `docker-compose -c firefly-stack.yml build <service_name>`.

Service images may extend from a base `firefly` image with dependencies like node pre-installed. This image is built by hand using `docker built -t firefly .`.

The `common/` directory is meant for modules that are shared by multiple services. Services that require these modules should `ADD` `common/` in their `Dockerfile`s, and the `firely-stack.dev.yml` file should add a volume for `common/`. To use common modules in tests, make a symlink in your service directory using `ln -s ../common`.

Note that `firefly-stack.dev.yml` creates unnamed volumes to `node_modules` directories, e.g. `/srv/<service_name>/node_modules` or `/srv/<service_name>/common/node_modules`. This is to ensure that the volume does not copy local `node_modules` (needed for testing) into the Docker container, which may need to have OS-specific dependencies built for it.

## Useful docker commands

`docker stack ls`: Show the stacks you have deployed.

`docker service ls`: Show all running services and # of active replicas.

`docker service ps <service_name>`: Show all created tasks for a service. Useful to figure out why a service won't come online (try the `--no-trunc` option).

`docker service logs -f <service_name>`: Tail the logs of a given service (includes logs from every replica belonging to that service).

`docker service update --force <service_name>`: Kills a service's tasks and recreates them. Useful to reload a service without recreating the whole stack.

## Tests

Run `npm test`. This first lints the entire project to check for style errors. Then it runs `npm test` on every directory.

If a spec takes more than 100ms then it is a "slow" spec and a message telling you this will be logged. Make it faster, or wrap the `it` in an `if (process.env.runSlowSpecs)` block. Run `npm run test:all` to run the slow tests.

## Contributing

* Make sure all commit messages follow the 50 character subject/72 character body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

* Make sure commit messages start with uppercase present tense commands e.g. Prefer "Clear selection when clicking templateExplorer" over "Cleared selection when clicking templateExplorer"

* Turn on "strip trailing whitespace on save" or equivalent in your editor

* Indent by 4 spaces, not tabs

## Logging

```javascript
var log = require("./logging").from(__filename);

log("string", {object: 1}, 123, "http://example.com");
```

Only use `console.log` while developing.

Some special characters will change the output:

### `*` Errors

Wrapping a string in `*`s will make it appear red in the logs, this is useful
when you need to log an error:

```javascript
log("*some error*", error.stack)
```

### Tracking errors and events

```javascript
var track = require("./track");
```

To aid debugging in production we track errors and some major events. Errors on the Joey chains are automatically tracked, however whenever you write a `.catch` (or, in old parlance, `.fail`) then you should add some code to track the error.

If you have a `request` variable in scope then use the following code which will pull the user's session data and other information from the request:

```javascript
track.error(error, request, /*optional object*/ data);
```

If you don't have `request` then you hopefully have the `username`:

```
track.errorForUsername(error, /*string*/ username, /*optional object*/ data);
```

Events can be tracked with the following code, using the same "rules" as above
for using `request`:

```javascript
track.message(/*string*/ message, request, /*optional object*/ data, /*optional string*/ level);
track.messageForUsername(/*string*/ message, /*string*/ username, /*optional object*/ data, /*optional string*/ level);
```

Messages should be written in the present tense without "-ing", e.g. "create container", **not** "creating container" or "created container" (unless the action really was in the past).

## Debugging Node

!! Under Construction - the information in this section is outdated !!

Run

* `npm run login-debug` or
* `npm run project-debug`

This sends a signal to the server process to enable debug mode, and then starts `node-inspector`. Sometimes the command exits with a weird error but running it again works.

The port that `node-inspector` is exposed on is defined in the package.json and forwarded in the Vagrantfile.

## Remote debugging Node

!! Under Construction - the information in this section is outdated !!

Run

* `npm run login-remote-debug` and use 10.0.0.4:5858 as the connection point or
* `npm run project-remote-debug` and use 10.0.0.5:5858 as the connection point

You can connect using the node-inspector running on the host machine or any other client that supports node.js remote debugging such as WebStorm.
