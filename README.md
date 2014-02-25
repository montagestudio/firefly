Firefly
=======

Firefly parallels the Beacon née Lumieres project as another host for the
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
    to speed up the initialization of the VMs.
 5. Run `vagrant plugin install vagrant-vbguest`. This will keep the
    VirtualBox Guest additions up to date.

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

Architecture overview
---------------------

```
                                Request
                                   v
                        +-----------------------+
.com/app/*   +----------+Load balancer (HAProxy)+-------+  .com/api/*
.com/assets/*|          +----------+------------+       | *.net/*
             |                     |                    |  websocket
             v                     v                    v
 +-------------------------+ +------------+ +-----------------------+
 |Static files (Nginx)     | |Login server| |Project server         |
 |filament + firefly/inject| +------------+ |+----------------+     |
 +-------------------------+                ||Container server| ... |
                                            |+----------------+     |
                                            +-----------------------+

 .com is short for the main app domain
 .net is short for the project/preview domain
```

Created with http://www.asciiflow.com/

Refreshing the server
---------------------

Run `npm run deploy`

You will need to run this whenever you make changes to Firefly.

This will restart the `login` and `project` servers, and stop all running
containers so on the next request they will be restarted with the updated code.
If either `login` or `project` fail to deploy the previous version will remain
running and the last 20 lines of the error log will be output.

### Containers

Run `npm run container-rm-all` to remove all containers from the project server.

Run `npm run container-rebuild` if you make changes to the `Dockerfile`. This
will rebuid the base container image.

Debugging Node
--------------

Run

 * `npm run login-debug` or
 * `npm run project-debug`

This sends a signal to the server process to enable debug mode, and then starts
`node-inspector`. Sometimes the command exits with a weird error but running it
again works.

The port that `node-inspector` is exposed on is defined in the package.json and
forwarded in the Vagrantfile.

Remote debugging Node
---------------------

Run

 * `npm run login-remote-debug` and use 10.0.0.4:5858 as the connection point or
 * `npm run project-remote-debug` and use 10.0.0.5:5858 as the connection point

You can connect using the node-inspector running on the host machine or any other client that supports node.js remote debugging such as WebStorm.

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

### Container

Run `npm run container-logs`

This will find the most recently launched container and start following the
logs.

### Static file server (Filament)

```bash
vagrant ssh web-server -c "tail -f /var/log/nginx/filament.access.log"
```

### Load balancer

```bash
vagrant ssh load-balancer -c "tail -f /var/log/haproxy.log"
```

You can also see the state of the load-balancer (HAProxy) and the servers at
http://local-firefly.declarativ.net:2440/admin?stats and logging in with
user `montage`, password `Mont@ge1789`.

Viewing the files inside the container
--------------------------------------

Run `npm run container-files`

This will find the most recently launched container and list all the
files that have changed inside of it. This is a quick way to see the state of
the container.

Run `npm run container-copy-files`

This will copy the files out of the container into a temporary directory. You
can look at the files but of course any changes won't be reflected in the
container.

### Mounting container workspaces

Run `npm run container-rm-all` to remove existing containers then,

run `npm run project-mount-workspaces`

You can then `vagrant ssh project` and find the workspaces from the containers
at `/srv/workspaces/$ID`, where `$ID` can be copied from the logs output
(look for something like
`Existing container for stuk stuk asdf is fdfe3244c4201429d4e28266cb3bbb488a132f21ae818ddd1ee693dcddc0bcf8`)

To reload the server just Ctrl+C the server and run the second command above
again, instead of running `npm run deploy`.

When finished run `npm run project-unmount-workspaces`

This will remove all the containers and workspaces on the project server, and
then restart the regular server.

### Viewing a specific container

Only `root` and the `docker` group can access the containers, so log into the
project server and change to `root`:

```bash
vagrant ssh project
sudo su
```

If don't know the ID of the container then you can get a list of all the
running containers with `docker ps`, or include the stopped containers with
`docker ps -a`.

If don't know which of the IDs you want then there is a map from
`{user, owner, repo}` to IDs in `/srv/container-index.json`. Look through that
file to find the relevant ID. (I hope this will change pretty soon, probably
to Redis.)

Using the ID of the container you can perform various actions:

```bash
docker logs $ID
docker diff $ID
docker cp $ID:/workspace /tmp
```

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
sudo sed -i.bak 's/redirect scheme https .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server static1 [0-9\.]*/server static1 10.0.0.3/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project1 [0-9\.]*/server project1 10.0.0.5/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project2 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg;\
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

Deploying is managed through Jenkins at
https://build.declarativ.com/jenkins/view/Aurora/job/Deploy%20Aurora/.

We currently deploy on Digital Ocean. This is done with 2 tools, Tugboat and
Packer. They get installed in the `./build` directory as part of the images
build process.

It is very useful to have Tugboat installed on your machine so run
`gem install tugboat` This will give a nice command line tool to access
Digital Ocean.

There 6 scripts you will be interested in:

 * `deploy/build/images.sh`
   It builds all 4 images including rebuilding the base image. It takes 30~40
   minutes to run.
 * `deploy/build/load-balancer-image.sh`
   It will build the load balancer image. It will not rebuild the base image if
   it already exists.
 * `deploy/build/web-server-image.sh`
   It will build the web server image. It will not rebuild the base image if it
   already exists.
 * `deploy/build/login-image.sh`
   It will build the login image. It will not rebuild the base image if it
   already exists.
 * `deploy/build/project-image.sh`
   It will build the project image. It will not rebuild the base image if it
   already exists.

Those 5 scripts accept 2 command line parameters: `-b firefly_branch` and
`-c filament_branch`

**Danger**

 * deploy/build/rebuild.sh
   This script rebuild the droplet from the existing images. By default it will
   rebuild the staging system. It will rebuild production with the `-p` argument.

**Danger**

In order to be able to login the droplets you will need to have your public key
added to `deploy/files/authorized_keys`. The only user on the production/
staging machines is admin and it is a sudoer.
