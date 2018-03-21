# Firefly

[![Build Status](https://travis-ci.com/montagestudio/firefly.svg?token=DkxazY7pbviHZyy38ZZb&branch=master)](https://travis-ci.com/montagestudio/firefly)

Firefly is the backend for Montage Studio.

Firefly provides multiple services related to editing a Montage application in the cloud, including Filament, the Montage Studio editor web application. Filament is served for use inside a browser and is given access to services through an Environment Bridge.

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
                        local.montage.studio
                        staging.montage.studio
                        montage.studio
                .net is short for the project/preview domain
                        project.local.montage.studio
                        project.staging.montage.studio
                        project.montage.studio

                Created with http://www.asciiflow.com/

Firefly consists of four services in a Docker swarm: Load Balancer (frontend entrypoint), Web Server (the filament application itself), Login, and the Project Daemon.

The Project Daemon is responsible for spawning and managing user project containers. These containers are where we perform git checkouts and npm installs of the user's project and serve the app for live preview. Each of these containers hold exactly one user project. Requests to interact with these containers are made through the Project Daemon (indirectly, through the Load Balancer).

While users just get a single docker container for their project that is outside their control for now, the eventual goal is to create a docker stack for each user, which they can control by defining a `docker-compose.yml` file in their project. 
## Quickstart

 1. Install Docker

 2. Install VirtualBox and VirtualBox Guest Additions

 3. Use npm v4: `nvm use 4`.

### Install dependencies and filament

```
npm install
```

### Create a swarm

For ease of development, Firefly is deployed locally in a swarm running natively on the guest OS. First, initialize a swarm with a single node (your machine):

```
docker swarm init
```

If the command complains about not being able to choose an IP address to advertise, choose your main IP address (check `ifconfig`) and specify it as your advertise address as follows:

```
docker swarm init --advertise-addr <YOUR_IP>
```

### Create a registry

In order to deploy services across the swarm, each node in the swarm must have each service's image built. Rather than building each service separately on each node, we use a docker registry to publish images and make them available to all nodes in the cluster. Create a local registry in your swarm:

```
docker service create --name docker-registry --publish 5000:5000 --detach=true \
    registry:2
```

The swarm now has access to a local registry at `127.0.0.1:5000` which it can use to pull service images. 

### Add a swarm visualizer

For ease of debugging and inspecting the swarm, you may add a swarm visualizer service to a cluster manager node. The visualizer provides a UI to see the different nodes in your swarm, see which services are running where, and what the status of every container is. Create the visualizer:

```
docker service create -d --name swarm-visualizer \
  -p 5001:8080 \
  --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock \
  dockersamples/visualizer
```

This will create a web application at 127.0.0.1:5001. You can use this to see which services as currently deployed.

### Build images

After first cloning the project, you must build all images in the application and push them onto the registry:

```
npm run build
```

This may take 20+ minutes the first time as the base image and all service images must be built from scratch. Afterwards most of the images will be cached so rebuilding will be much faster.

Image building only needs to be done locally if you change any of the Dockerfiles. Otherwise the firefly and filament sources are synced to the images via docker volumes. Changes to firefly only require an update to all the services with `npm start`.

### Deploy

Run `npm start`. This deploys the firefly stack to the swarm. You can run `npm stop` to remove the stack from the swarm.

You can then access the server at http://local.montage.studio:2440/.
local.montage.studio is an alias for localhost.

## Developing

### Debugging Node

!! Under Construction - the information in this section is outdated !!

Run

* `npm run login-debug` or
* `npm run project-debug`

This sends a signal to the server process to enable debug mode, and then starts `node-inspector`. Sometimes the command exits with a weird error but running it again works.

The port that `node-inspector` is exposed on is defined in the package.json and forwarded in the Vagrantfile.

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

### Viewing the files inside the container

!! Under Construction - the information in this section is outdated !!

Run `npm run container-files`

This will find the most recently launched container and list all the files that have changed inside of it. This is a quick way to see the state of the container.

Run `npm run container-copy-files`

This will copy the files out of the container into a temporary directory. You can look at the files but of course any changes won't be reflected in the container.

### Viewing a specific container

!! Under Construction - the information in this section is outdated !!

Only `root` and the `docker` group can access the containers, so log into the project server and change to `root`:

```bash
vagrant ssh project
sudo su
```

If don't know the ID of the container then you can get a list of all the running containers with `docker ps`, or include the stopped containers with `docker ps -a`.

If don't know which of the IDs you want then there is a map from `{user, owner, repo}` to IDs in `/srv/container-index.json`. Look through that file to find the relevant ID. (I hope this will change pretty soon, probably
to Redis.)

Using the ID of the container you can perform various actions:

```bash
docker logs $ID
docker diff $ID
docker cp $ID:/workspace /tmp
```

### Session

The session is available as `request.session`. After a Github auth it has a `githubAccessToken` property, containing the token.

The session contains the Github access token and Github username. It's encrypted and stored entirely on the client. When a server recieves a session that it hasn't seen before then it uses the Github token to populate other information from the Github API in memory.

This scheme isn't perfect as sessions can't be revoked (although the user can revoke their Github token on Github, killing the session on our end as well), but it allows all the servers to be relatively stateless.

## Contributing

* Run the specs (`npm test`) at the project's root and make sure there are no `jshint` errors and all specs pass successfully.

  Note: the binary dependencies are compiled for Linux instead of OS X so when running `npm test` on a non-Linux platform it will attempt to SSH into a VM to run the tests. If you get the error `VM must be running to open SSH connection` then run `npm start` and try again.

  Note: there is a dummy spec called `_config-spec.js` (the `_` prefix causes it to be run first), that hides the logging while running the tests. If you need to see the logs then comment out the lines in it. It also adds the `SlowSpecReporter`...

* If a spec takes more than 100ms then it is a "slow" spec and a message telling you this will be logged. Make it faster, or wrap the `it` in an `if (process.env.runSlowSpecs)` block. Run `npm run test:all` to run the slow tests.

* Make sure all commit messages follow the 50 character subject/72 character body [formatting used throughout git](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)

* Make sure commit messages start with uppercase present tense commands e.g. Prefer "Clear selection when clicking templateExplorer" over "Cleared selection when clicking templateExplorer"

* Turn on "strip trailing whitespace on save" or equivalent in your editor

* Indent by 4 spaces, not tabs

## Testing with a more prod-like setup

To make development easier, we deploy the firefly stack on a swarm directly on the host OS. This means that there is only one node in the swarm, while in a real staging/production environment there would be three or more. Also, we use a separate stack yml file for development (`firefly-stack-dev.yml`) which creates volumes on each service to the parts of firefly they need, so that changes to the firefly source require just a container restart instead of an image rebuild.

When making significant architecture changes, it is a good idea to test on a more prod-like configuration as well. In order to do so, create three docker-machine machines and deploy the stack in a special development mode. Many of these instructions are similar to the steps for deploying to DigitalOcean.

### Create a cluster of docker machines

First, set up Docker Swarm with a cluster of 3 VM nodes:

```
docker-machine create --driver virtualbox firefly1
docker-machine create --driver virtualbox firefly2
docker-machine create --driver virtualbox firefly3
```

Now open the VirtualBox UI. Open Settings>Network>Adapter 1>Advanced>Port Forwarding for the firefly1 machine. Add an entry with the host IP 127.0.0.1, host port 2440 and guest port 2440. This way Firefly can be reached at local.montage.studio (an alias for localhost) instead of the machine's IP.

Once that is done, restart each machine:

```
docker-machine restart firefly1 firefly2 firefly3
```

### Create the swarm

Now, use `docker-machine ls` to check that all your machines are created, and look for the IP address of the "firefly1" node.

Instruct the "firefly1" node to become a swarm manager:

```
docker-machine ssh firefly1 "docker swarm init --advertise-addr <firefly1 ip>"
```

The command above will output a command for adding workers to the swarm. Add the other two nodes as workers:

```
docker-machine ssh firefly2 "docker swarm join --token <token> <firefly1 ip>"
docker-machine ssh firefly3 "docker swarm join --token <token> <firefly1 ip>"
```

Run `docker-machine ssh firefly1 "docker node ls"` to check the status of the swarm. Now Docker Swarm will distribute service containers across the different nodes.

### Configure your shell

Now that the cluster is initialized, you will need to configure your shell to communicate with the manager node's Docker daemon instead of the local daemon. That way you can run Docker commands directly without wrapping them in a `docker-machine ssh` call.

Run `docker-machine env firefly1` to get the command to configure your shell. The command will look something like `eval $(docker-machine env firefly)`. Use `docker-machine ls` to verify that the active machine is now firefly 1. Note that this process must be repeated for any new shell that you open.

## Publishing

The development environment is designed to be almost identical to staging and
production. The main difference is that we use `docker-machine` with the DigitalOcean
driver instead of VirtualBox.

You will need a DigitalOcean access token to interact with droplets.

### Setup

* Run `deploy/build/setup.sh`. This will install packer and tugboat. You will likely get a message about needing to run `tugboat authorize`, ignore this for now.

* Run `source deploy/build/env.sh` to set up your shell's environment. This adds packer and tugboat to your path and defines several useful environment variables for debugging the deployment process.

* Run `echo $DIGITALOCEAN_API_TOKEN` after setting the environment up above to print out the api token to use in the next step.

* Run `tugboat authorize`. Use the API token from the previous step, and when it asks, set the default ssh username to admin and give the absolute path to your ssh public key (e.g. /home/username/.ssh/id_rsa.pub on Linux or /Users/username/.ssh/id_rsa.pub on MacOS).

* Add your public key to `deploy/files/authorized_keys`. You will not be able to ssh into the droplets without it.

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
