# Developing

## Building Images

Firefly consists of several images. Most of these images are defined in the `docker-compose.yml` file and as such are built by docker-compose. The exception is the project image, whose containers are created at runtime and therefore the image is built separately.

`npm run build` builds both the images in `docker-compose.yml` and the project image. You can also use `npm run build:project` to build just the project image. Remember to do this every time you change the files in `project/`.

`npm start` runs a `docker-compose up -d --build`, so it will rebuild any images that changed and update any containers that need to be updated. Whenever you change any backend code (other than in `project/`), `npm start` is enough to update the system.

Changes to `static/filament` do not require an `npm start`. In development, the `docker-compose.override.yml` file defines a volume so that the filament code is automatically synchronized to the static container. Just refresh the page to see filament updated.

## Useful docker commands

`docker ps`: Show running containers.

`docker logs -f <container name or id>`: Tail the logs of the given container.

`docker exec -it <container name or id> bash`: Open a shell in the given container to check the filesystem.

## Tests

Run `npm run lint` to check the project for style errors. Run `npm test` to run `npm test` on every directory.

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
