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

Run `npm run lint` to check the project for style errors. Run `npm test` inside individual service directories to test services. Each service should build a Docker image and then run the test suite inside that image. This ensures the testing environment is completely isolated from the development machine, and means you don't need to `npm install` individual services in order to test them.

## Contributing

* Make sure all commit messages follow the 50 character subject/72 character body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

* Make sure commit messages start with uppercase present tense commands e.g. Prefer "Clear selection when clicking templateExplorer" over "Cleared selection when clicking templateExplorer"

* Turn on "strip trailing whitespace on save" or equivalent in your editor

* Indent by 4 spaces, not tabs

## Logging

```javascript
var log = require("logging").from(__filename);

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
