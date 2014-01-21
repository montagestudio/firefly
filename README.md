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
filament/
firefly/
```

Install Vagrant from http://www.vagrantup.com/downloads.html

To start Firefly run:

```bash
npm start
```

This can take up to 15 minutes the first time as the local VMs are provisioned
from scratch.

You can then access the server at http://localhost:8082/

Run

```bash
npm stop
```

to shutdown the VMs. You can bring them back up with `npm start`, but this
time they are all set up, and so it should be reasonably fast.

Logs (TODO make this section nicer)
----

You can follow the logs from the various servers with:

```
vagrant ssh web-server -c "tail -f /var/log/nginx/filament.access.log"
```

```
vagrant ssh login -c "tail -f /home/montage/stdout.log"
vagrant ssh login -c "tail -f /home/montage/stderr.log"
vagrant ssh login -c "tail -f /var/log/upstart/firefly.log"
```

```
vagrant ssh load-balancer -c "tail -f /var/log/haproxy.log"
```

Developing
==========

Logging
-------

```javascript
var log = require("logging").from(__filename);

log("string", {object: 1}, 123, "http://example.com");
```

Only use `console.log` while developing.

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
- Run `jshint` on your code to ensure it conforms to Filament standards

- Make sure all commit messages follow the 50 character subject/72 character
body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

- Make sure commit messages start with uppercase present tense commands
e.g. Prefer "Clear selection when clicking templateExplorer" over
"Cleared selection when clicking templateExplorer"

Updating dependencies
---------------------

The dependencies are checked in [as recomended](http://www.futurealoof.com/posts/nodemodules-in-git.html)
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
