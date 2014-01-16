Firefly
=======

Firefly parallels the Beacon neé Lumieres project as another host for the
Filament application.

Firefly will serve Filament itself for use inside a browser and also provide
services access to services for consumption in Filament much like Beacon does
through its associated Environment Bridge.

Running
=======

Next to Firefly both Filament must be checked out and a directory called
"clone" must exist:

```
clone/
filament/
firefly/
```

To start Firefly run:

```bash
npm start
```

This will output the URL where the server is running.

You can configure where Filament lives by running:

```bash
node index.js --client=<directory containing filament>
```

Run `node index.js` with no arguments to get a list of command line options.

Developing
==========

Logging
-------

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
log("*some error*", error.message)
```

Session
-------

The session is available as `request.session`. After a Github auth it has a
`githubAccessToken` property, containing the token.

To store more data in the session just add a property to the `request.session`
object.

The session is stored in memory, and so after a server restart all sessions are
lost (and you need to go through the Github auth again to get another access
key).

Contributing
============
- Run the specs (`npm test`) at the project's root and make sure there is no `jshint` errors and all spec tests pass successfully.
  Note: make sure there is no firefly session running prior running the test.

- Make sure all commit messages follow the 50 character subject/72 character
body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

- Make sure commit messages start with uppercase present tense commands
e.g. Prefer "Clear selection when clicking templateExplorer" over
"Cleared selection when clicking templateExplorer"

- Turn on "strip trailing whitespace on save" or equivalent in your editor

- Indent by 4 spaces, not tabs

Updating dependencies
---------------------

The dependencies are checked in [as recommendedd](http://www.futurealoof.com/posts/nodemodules-in-git.html)
by members of the community. To update them run:

```bash
npm run update-dependencies
```

This will remove all the existing dependencies, install and dedupe, and stage
the node_modules. At this point you should test and rollback any dependencies
that you don't want to update.

Deploying
=========

Deploying in managed through Jenkins at https://build.declarativ.com/jenkins/view/Aurora/job/Deploy%20Aurora/.

The server that is being deployed to must have the following environment variables set:

 * `IP_ADDRESS`
 * `NODE_ENV="production"`
 * `FIREFLY_PORT`
 * `FIREFLY_APP_URL`
 * `FIREFLY_PROJECT_URL`
 * `GITHUB_CLIENT_ID`
 * `GITHUB_CLIENT_SECRET`

The script currently used to deploy is available in `deploy.sh`.
