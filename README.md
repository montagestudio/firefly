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

## Getting Started

[Getting Started](GETTING_STARTED.md)

## Developing

[Developing](DEVELOPING.md)

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
