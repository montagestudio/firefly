# Firefly

[![Build Status](https://travis-ci.com/montagestudio/firefly.svg?token=DkxazY7pbviHZyy38ZZb&branch=master)](https://travis-ci.com/montagestudio/firefly)

Firefly is the backend for Montage Studio.

Firefly provides multiple services related to editing a Montage application in
the cloud, including Filament, the Montage Studio editor web application. Filament
is served for use inside a browser and is given access to services through an
Environment Bridge.

## Architecture overview

                                                Request
                                                   v
                                        +-----------------------+
                .com/app/*   +----------+Load balancer (HAProxy)+-------+  .com/api/*
                .com/assets/*|          +----------+------------+       | *.net/*
                             |                     |                    |  websocket
                             v                     v                    v
                +-------------------------+ +------------+ +-----------------------+      +--------------+  
                |Web Server               | |Login server| |Project daemon         | <--> |Project server| ...
                |static files (Nginx)     | +------------+ | Creates new project   |      +--------------+
                |filament + firefly/inject|                | containers            |      +--------------+
                +-------------------------+                |                       | <--> |Project server| ...
                                                           +-----------------------+      +--------------+

                .com is short for the main app domain
                        local-aurora.montagestudio.com
                        staging-aurora.montagestudio.com
                        work.montagestudio.com
                .net is short for the project/preview domain
                        *.local-project.montagestudio.net
                        *.staging-project.montagestudio.net
                        *.project.montagestudio.net

                Created with http://www.asciiflow.com/

Firefly consists of four services in a Docker swarm: Load Balancer
(frontend entrypoint), Web Server (the filament application itself),
Login, and the Project Daemon.

The Project Daemon is responsible for spawning and managing user project containers.
These containers are where we perform git checkouts and npm installs of the user's
project and serve the app for live preview. Each of these containers hold exactly
one user project. Requests to interact with these containers are made through the
Project Daemon (indirectly, through the Load Balancer).

While users just get a single docker container for their project that is outside their
control for now, the eventual goal is to create a docker stack for each user, which they
can control by defining a `docker-compose.yml` file in their project.

## Local Development

### Initial setup

 1. You must check out Filament next to Firefly, so that it looks like this:

    ```
    filament/
    firefly/
    ```

 2. Install Docker

### Starting

Run `npm start`. This sets up the docker swarm and runs each service. The first run can take 20+ minutes as Docker must download requisite images and build the project container image. After the first build these images are cached and running should take no more than 30 seconds.

If you are running locally, you must run `NODE_ENV=development npm start` instead to disable https redirection. This will become unnecessary once we add a consistent process for adding self-signed certificates.

You can then access the server at http://local-aurora.montagestudio.com:2440/.
local-aurora.montagestudio.com is an alias for localhost.
A Docker visualizer is made available at http://127.0.0.1:5001/.

### Stopping

Run `npm stop`

This will destroy the swarm. You can use this liberally, as unlike the old VM-based architecture, `npm start` completes very quickly.

### Refreshing the server

!! Under Construction - the information in this section is outdated !!

Run `npm run deploy`

You will need to run this whenever you make changes to Firefly only. Changes to
Filament do not need a server refresh, simply reload the page to see UI changes.

This will restart the `login` and `project` servers, and stop all running
containers so on the next request they will be restarted with the updated code.
If either `login` or `project` fail to deploy the previous version will remain
running and the last 20 lines of the error log will be output.

### Containers

!! Under Construction - the information in this section is outdated !!

Run `npm run container-rm-all` to remove all containers from the project server.

Run `npm run container-rebuild` if you make changes to the `Dockerfile`. This
will rebuid the base container image.

### Debugging Node

!! Under Construction - the information in this section is outdated !!

Run

* `npm run login-debug` or
* `npm run project-debug`

This sends a signal to the server process to enable debug mode, and then starts
`node-inspector`. Sometimes the command exits with a weird error but running it
again works.

The port that `node-inspector` is exposed on is defined in the package.json and
forwarded in the Vagrantfile.

### Remote debugging Node

!! Under Construction - the information in this section is outdated !!

Run

* `npm run login-remote-debug` and use 10.0.0.4:5858 as the connection point or
* `npm run project-remote-debug` and use 10.0.0.5:5858 as the connection point

You can connect using the node-inspector running on the host machine or any other client that supports node.js remote debugging such as WebStorm.

### Logging

```javascript
var log = require("./logging").from(__filename);

log("string", {object: 1}, 123, "http://example.com");
```

Only use `console.log` while developing.

Some special characters will change the output:

#### `*` Errors

Wrapping a string in `*`s will make it appear red in the logs, this is useful
when you need to log an error:

```javascript
log("*some error*", error.stack)
```

#### Tracking errors and events

```javascript
var track = require("./track");
```

To aid debugging in production we track errors and some major events. Errors
on the Joey chains are automatically tracked, however whenever you write a
`.catch` (or, in old parlance, `.fail`) then you should add some code to track
the error.

If you have a `request` variable in scope then use the following code which
will pull the user's session data and other information from the request:

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

Messages should be written in the present tense without "-ing", e.g.
"create container", **not** "creating container" or "created container" (unless
the action really was in the past).

### Common errors

```
XMLHttpRequest cannot load http://local-aurora.montagestudio.com:2440/. No 'Access-Control-Allow-Origin' header is present on the requested resource. Origin 'null' is therefore not allowed access.
```

This happens when the project subdomain doesn't have the session cookie.

Why? This is caused by a cross-domain request to the project domain. When the
project server doesn't find a valid session it does a 304 redirect back to the
app domain. This is blocked because there are no cross-domain headers on the
app domain (despite the request now really being non-cross domain). Hence the
error showing the app domain in the message, and the `Origin` being null
because it comes from a redirect.

## Administration

### Accessing logs

!! Under Construction - the information in this section is outdated !!

You can `ssh` into the different machines with `vagrant ssh $NAME`. Files are
generally located at `/srv`. You can run the commands below to directly follow
the logs for the different servers:

#### Login

Run `npm run login-logs`

When the server fails to launch:

```bash
vagrant ssh login -c "tail -f /home/montage/stderr.log"
vagrant ssh login -c "sudo tail -n 30 /var/log/upstart/firefly-login.log"
```

#### Project

Run `npm run project-logs`

When the server fails to launch:

```bash
vagrant ssh project -c "tail -f /home/montage/stderr.log"
vagrant ssh project -c "sudo tail -n 30 /var/log/upstart/firefly-project.log"
```

#### Container

Run `npm run container-logs`

This will find the most recently launched container and start following the
logs.

#### Static file server (Filament)

```bash
vagrant ssh web-server -c "tail -f /var/log/nginx/filament.access.log"
```

#### Load balancer

```bash
vagrant ssh load-balancer -c "tail -f /var/log/haproxy.log"
```

You can also see the state of the load-balancer (HAProxy) and the servers at
http://local-aurora.montagestudio.com:2440/admin?stats and logging in with
user `montage`, password `Mont@ge1789`.

### Viewing the files inside the container

!! Under Construction - the information in this section is outdated !!

Run `npm run container-files`

This will find the most recently launched container and list all the
files that have changed inside of it. This is a quick way to see the state of
the container.

Run `npm run container-copy-files`

This will copy the files out of the container into a temporary directory. You
can look at the files but of course any changes won't be reflected in the
container.

### Mounting container workspaces

!! Under Construction - the information in this section is outdated !!

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

!! Under Construction - the information in this section is outdated !!

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

### Session

The session is available as `request.session`. After a Github auth it has a
`githubAccessToken` property, containing the token.

The session contains the Github access token and Github username. It's
encrypted and stored entirely on the client. When a server recieves a session
that it hasn't seen before then it uses the Github token to populate other
information from the Github API in memory.

This scheme isn't perfect as sessions can't be revoked (although the user can
revoke their Github token on Github, killing the session on our end as well),
but it allows all the servers to be relatively stateless.

### Provisioning

!! Under Construction - the information in this section is outdated !!

Here are some more useful commands if you change any config files or other
aspects of the provisioning.

#### Upstart services

If you need to change the Upstart config files you need to restart the service:

```bash
vagrant ssh login -c "sudo cp /vagrant/deploy/services/firefly-login.conf /etc/init/firefly-login.conf"
vagrant ssh login -c "sudo service firefly-login restart"

vagrant ssh project -c "sudo cp /vagrant/deploy/services/firefly-project.conf /etc/init/firefly-project.conf"
vagrant ssh project -c "sudo service firefly-project restart"
```

#### HAProxy config file

The new config needs to be copied across and certain values replaced. (This
command is adapted from the Vagrantfile).

```bash
vagrant ssh load-balancer -c "sudo cp /vagrant/deploy/files/haproxy.cfg /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/redirect scheme https .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login1 [0-9\.]*/server login1 10.0.0.4/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server login2 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server static1 [0-9\.]*/server static1 10.0.0.3/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/use-server .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project1 [0-9\.]*/server project1 10.0.0.5/' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project2 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project3 .*//' /etc/haproxy/haproxy.cfg;\
sudo sed -i.bak 's/server project4 .*//' /etc/haproxy/haproxy.cfg;\
sudo service haproxy reload"
```

## Contributing

* Run the specs (`npm test`) at the project's root and make sure there are no
  `jshint` errors and all specs pass successfully.

  Note: the binary dependencies are compiled for Linux instead of OS X so
  when running `npm test` on a non-Linux platform it will attempt to SSH into
  a VM to run the tests. If you get the error `VM must be running to open SSH
  connection` then run `npm start` and try again.

  Note: there is a dummy spec called `_config-spec.js` (the `_` prefix
  causes it to be run first), that hides the logging while running the tests.
  If you need to see the logs then comment out the lines in it. It also adds
  the `SlowSpecReporter`...

* If a spec takes more than 100ms then it is a "slow" spec and a message
  telling you this will be logged. Make it faster, or wrap the `it` in an
  `if (process.env.runSlowSpecs)` block. Run `npm run test:all` to run the
  slow tests.

* Make sure all commit messages follow the 50 character subject/72 character
  body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

* Make sure commit messages start with uppercase present tense commands
  e.g. Prefer "Clear selection when clicking templateExplorer" over
  "Cleared selection when clicking templateExplorer"

* Turn on "strip trailing whitespace on save" or equivalent in your editor

* Indent by 4 spaces, not tabs

## Deploying

!! Under Construction - the information in this section is outdated !!

### Overview

The deployment process mainly relies on two third-party tools: `packer` and `tugboat`.

`packer` is used to create images through Digital Ocean. It uses the
`build/*-image.sh` scripts to set up default values and perform pre-build
steps, then reads the `./*-image.json` configuration files to walk through its
image creation process. These .json files are used to describe the properties
of DigitalOcean droplets (using the standard DO API), to copy configuration
files from `files` and `services`, and to execute scripts from `provision` on
the droplets that initialize them for use. Finally packer takes a snapshot of
the droplet to produce an image (`.iso`) which will be used when deploying.

`tugboat` is used to actually interact with the existing droplets, while
`packer` creates intermediate temporary droplets just for the purpose of
snapshotting. It allows us to flash the new images onto existing droplets, ssh
into them by name, check their statuses, etc. Note: When this deployment
process was first created there was no equivalent to `tugboat`, but now there
is an official tool maintained by DigitalOcean, `doctl`, which we should
migrate to instead.

### Setup

* Run `deploy/build/setup.sh`. This will install packer and tugboat. You will
  likely get a message about needing to run `tugboat authorize`, ignore this
  for now.

* Run `source deploy/build/env.sh` to set up your shell's environment. This
  adds packer and tugboat to your path and defines several useful environment
  variables for debugging the deployment process.

* Run `echo $DIGITALOCEAN_API_TOKEN` after setting the environment up above to
  print out the api token to use in the next step.

* Run `tugboat authorize`. Use the API token from the previous step, and when
  it asks, set the default ssh username to admin and give the absolute path to
  your ssh public key (e.g. /home/username/.ssh/id_rsa.pub on Linux or
  /Users/username/.ssh/id_rsa.pub on MacOS).

* Add your public key to `deploy/files/authorized_keys`. You will not be able
  to ssh into the droplets without it.

### Deployment Scripts

`deploy/build/images.sh`:

    SYNOPSIS
        deploy/build/images.sh [-ftx] [-b branch] [-c branch] [-n build_number] [-r build_revision]

    DESCRIPTION
        Uses packer to generate the `.iso` images. There are several images that can be built
        using this script: the base image, which is the base for all other images and only needs
        to be rebuilt when upgrading the OS; individual base images which install the required
        software for each VM; specific images which install application-specific configuration.
        For most deployments only the specific (non-base) images need to be rebuilt, unless
        something at the OS level or underlying software level is changed.

        Building images will automatically tag the `firefly` and `filament` repositories with a new
        release version unless specified otherwise. The two repositories will be cloned temporarily
        while doing the deployment, so any local application changes that have not been pushed
        upstream will not be included in the deployment (except the `deploy/` directory, which
        is only used locally).

    OPTIONS
        -f      Force base image rebuild. Rebuilds the `base-image` and `*-base-image`.
                Only needed when upgrading the OS or making a change in the base software needed
                on a machine.

        -t      Do not tag repositories. Prevents the step from automatically creating a new
                release on `firefly` and `filament`. Useful when debugging and trying out many
                deployments, but all published deployments should be given a release.

        -x      BASh debug mode.

        -b filament_branch
                Specify which branch of filament should be pulled.

        -c firefly_branch
                Specify which branch of firefly should be pulled.

        -n build_number
                Use the build_number when creating a new release. E.g. the '21' part of 'miranda/21'.
                Defaults to one more than the last build number if not specified.

        -r build_revision
                The name to use when creating a new release. E.g. the 'miranda' part of 'miranda/21'.
                Defaults to the revision defined in deploy/build/env.sh if not specified.


`deploy/build/rebuild.sh`:

    SYNOPSIS
        deploy/build/rebuild.sh [-p] [-n build_number] [-r build_revision]

    DESCRIPTION
        Once the images are built, this script actually resets the Digital Ocean droplets with
        the new images. Each of the droplets in the selected working set will be shut down,
        the corresponding image will be written over their file system, and they will be rebooted.
        Deploys staging unless specified for production.

    OPTIONS
        -p      Deploys to production droplets instead of staging.

        -n build_number
                Use the image with the given build_number. Defaults to the latest build of the
                current revision if not specified.

        -r build_revision
                Use the image with the given build_revision. Defaults to the revision defined
                in deploy/build/env.sh if not specified.

### Directories

#### build/

Run one of these scripts to start the build of an image.

#### files/

Configuration files to be copied into the images.

#### provision/

Scripts that are run inside of a new VM to set up all the packages and code that are needed.

#### services/

These are configuration files for [Upstart](http://upstart.ubuntu.com/), to launch services when a machine boots. See the [manual](http://upstart.ubuntu.com/cookbook/).

#### ../.deploy/

This directory is created in the root of firefly to store the `packer` and `tugboat` binaries

## Posting status updates

Email qmhaxgmmxepk4@tumblr.com with the update in the subject and a body of `#minor` or `#major` to indicate the severity, or `#good` if everything is okay again. Minor or major statuses will appear in the tool (good ones won't) and all posts appear on http://status.montagestudio.com/

**Remember:** always resolve #major or #minor problems with a #good post, so that the warning will disappear in the tool.

If you want to include more information in the body put it before the #tag, but this won't be shown in the tool. Example:

```
To: qmhaxgmmxepk4@tumblr.com
Subject: Issues opening projects

There are problems opening projects at the moment.

#major
```

More information at https://www.tumblr.com/docs/en/email_publishing
