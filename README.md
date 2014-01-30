Firefly
=======

Firefly parallels the Beacon neé Lumieres project as another host for the
Filament application.

Firefly will serve Filament itself for use inside a browser and also provide
services access to services for consumption in Filament much like Beacon does
through its associated Environment Bridge.

Running
=======

Initial setup
-------------

 1. You must check out Filament next to Firefly, so that it looks like this:

    ```
    filament/
    firefly/
    ```

 2. Install VirtualBox from https://www.virtualbox.org/wiki/Downloads if you
    don't have it installed already. You may need to add
    `/Applications/VirtualBox.app/Contents/MacOS/VBoxManage` to your `PATH`.
 3. Install Vagrant from http://www.vagrantup.com/downloads.html
 4. Run `vagrant plugin install vagrant-cachier`. This will cache apt packages
    to speed up the initialization of the VMs

Starting
--------

Run `npm start`

This can take up to 20 minutes the first time as the local VMs are provisioned
from scratch, however the result is a local setup that's very similar to the
production setup. This means that we should be able to avoid causing problems
that would usually only be seen in production.

You can then access the server at http://local-firefly.declarativ.net:2440/

### Expected warnings

There is a lot of output when provisioning, and a number of warnings. The ones
below are expected:

```
dpkg-preconfigure: unable to re-open stdin: No such file or directory
```

```
The guest additions on this VM do not match the installed version of VirtualBox
```

```
adduser: The group `admin' already exists.
adduser: The user `admin' does not exist.
chown: invalid user: `admin:admin'
```

```
stdin: is not a tty
```

### Resuming after sleep

Sometimes the VMs will not resume correctly after your laptop has gone to sleep
and been woken up again (it seems this happens most frequently with
`load-balancer`). You can force them to shutdown and boot again with:

```bash
vagrant halt -f load-balancer  # or replace `load-balancer` with another name
# The following warning is expected:
# vagrant-cachier was unable to SSH into the VM to remove symlinks!
vagrant up load-balancer
```

Stopping
--------

Run `npm stop`

This will shutdown the VMs. You can bring them back up with `npm start` which
should take < 1 minute now that they are all set up.

After running `npm stop` the machines are not using CPU, but still take up
disk space. Instead of `npm stop` you can run `vagrant destroy` to remove the
VMs from disk. You can use `npm start` to bring them back, but this will take
almost the same amount of time as the initial setup.

Developing
==========

Refreshing the server
---------------------

Run `npm run deploy`

You will need to run this whenever you make changes to Firefly.

This will restart both the `login` and `project` servers. If either fail to
deploy the previous version will remain running and the last 20 lines of the
error log will be output.

Debugging Node
--------------

Run

 * `npm run login-debug` and go to http://127.0.0.1:8104/debug?port=5858 or
 * `npm run project-debug` and go to http://127.0.0.1:8105/debug?port=5858

This sends a signal to the server process to enable debug mode, and then starts
`node-inspector`. Sometimes the command exits with a weird error but running it
again works.

The port that `node-inspector` is exposed on is defined in the Vagrantfile.

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
log("*some error*", error.stack)
```

Accessing logs
--------------

You can `ssh` into the different machines with `vagrant ssh $NAME`. Files are
generally located at `/srv`. You can run the commands below to directly follow
the logs for the different servers:

### Login

Run `npm run login-logs`

When the server fails to launch:

```bash
vagrant ssh login -c "tail -f /home/montage/stderr.log"
vagrant ssh login -c "sudo tail -n 30 /var/log/upstart/firefly-login.log"
```

### Project

Run `npm run project-logs`

When the server fails to launch:

```bash
vagrant ssh project -c "tail -f /home/montage/stderr.log"
vagrant ssh project -c "sudo tail -n 30 /var/log/upstart/firefly-project.log"
```

### Static file server (Filament)

```bash
vagrant ssh web-server -c "tail -f /var/log/nginx/filament.access.log"
```

### Load balancer

```bash
vagrant ssh load-balancer -c "tail -f /var/log/haproxy.log"
```

You can also see the state of the load-balancer (HAProxy) and the servers at
http://local-firefly.declarativ.net:2440/haproxy?stats and logging in with
user `montage`, password `Mont@ge1789`.

Viewing the clone directory
---------------------------

Run `npm run project-clone`

This will drop you into a shell inside the `/srv/clone` directory.

Session
-------

The session is available as `request.session`. After a Github auth it has a
`githubAccessToken` property, containing the token.

The session contains the Github access token and Github username. It's
encrypted and stored entirely on the client. When a server recieves a session
that it hasn't seen before then it uses the Github token to populate other
information from the Github API in memory.

This scheme isn't perfect as sessions can't be revoked (although the user can
revoke their Github token on Github, killing the session on our end as well),
but it allows all the servers to be relatively stateless.

Common errors
-------------

```
XMLHttpRequest cannot load http://local-firefly.declarativ.net:2440/. No 'Access-Control-Allow-Origin' header is present on the requested resource. Origin 'null' is therefore not allowed access.
```

This happens when the project subdomain doesn't have the session cookie.

Why? This is caused by a cross-domain request to the project domain. When the
project server doesn't find a valid session it does a 304 redirect back to the
app domain. This is blocked because there are no cross-domain headers on the
app domain (despite the request now really being non-cross domain). Hence the
error showing the app domain in the message, and the `Origin` being null
because it comes from a redirect.

Provisioning
------------

Here are some more useful commands if you change any config files or other
aspects of the provisioning.

### Upstart services

If you need to change the Upstart config files you need to restart the service:

```bash
vagrant ssh login -c "sudo cp /vagrant/deploy/services/firefly-login.conf /etc/init/firefly-login.conf"
vagrant ssh login -c "sudo service firefly-login restart"

vagrant ssh project -c "sudo cp /vagrant/deploy/services/firefly-project.conf /etc/init/firefly-project.conf"
vagrant ssh project -c "sudo service firefly-project restart"
```

### HAProxy config file

The new config needs to be copied across and certain values replaced. (This
command is adapted from the Vagrantfile).

```bash
vagrant ssh load-balancer -c "sudo cp /vagrant/deploy/files/haproxy.cfg /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server static1 [0-9\.]*/server static1 10.0.0.3/' /etc/haproxy/haproxy.cfg;\
sudo service haproxy reload"
```

Contributing
============
- Run the specs (`npm test`) at the project's root and make sure there are no
  `jshint` errors and all specs pass successfully.

  Note: the binary dependencies are compiled for Linux instead of OS X so
  when running `npm test` on a non-Linux platform it will attempt to SSH into
  a VM to run the tests. If you get the error `VM must be running to open SSH
  connection` then run `npm start` and try again.

  Note: there is a dummy spec called `_disable-logging-spec.js` (the `_` prefix
  causes it to be run first), that hides the logging while running the tests.
  If you need to see the logs then comment out the lines in it.

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
by members of the community. To update them login into a VM
(`vagrant ssh login`), `cd /srv/firefly` and run:

```bash
npm run update-dependencies
```

This will remove all the existing dependencies, install and dedupe, and stage
the node_modules. At this point you should test and rollback any dependencies
that you don't want to update.

Any checked in binary modules **must** be added and compiled for Linux (that's
why you run this command inside the VM).

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
