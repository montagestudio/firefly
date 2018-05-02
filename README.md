# Firefly

[![Build Status](https://travis-ci.com/montagestudio/firefly.svg?token=DkxazY7pbviHZyy38ZZb&branch=master)](https://travis-ci.com/montagestudio/firefly)

Firefly is the backend for Montage Studio.

Firefly provides multiple services related to editing a Montage application in the cloud, including Filament, the Montage Studio editor web application. Filament is served for use inside a browser and is given access to services through an Environment Bridge.

## Architecture overview

                                                Request
                                                   v
                                        +-----------------------+
                .com/app/*   +----------+Load balancer (Traefik)+-------+  .com/api/*
                .com/assets/*|          +----------+------------+       | *.net/*
                             |                     |                    |  websocket
                             v                     v                    v
                +-------------------------+ +------------+ +-----------------------+      +--------------+  
                |Web Server               | |montage-auth| |Project daemon         | <--> |Project server| ...
                |static files (Nginx)     | +------------+ | Creates new project   |      +--------------+
                |filament                 |                | containers            |      +--------------+
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

Firefly consists of four Docker services: Load Balancer (frontend entrypoint), Web Server (the filament application itself), auth, and the Project Daemon.

The Project Daemon is responsible for spawning and managing user project containers. These containers are where we perform git checkouts and npm installs of the user's project and serve the app for live preview. Each of these containers hold exactly one user project. Requests to interact with these containers are made through the Project Daemon (indirectly, through the Load Balancer).

## Getting Started

[Getting Started](GETTING_STARTED.md)

## Developing

[Developing](DEVELOPING.md)

## Publishing

On every commit to the `develop` branch, Travis builds and pushes all service images (with the `latest` tag) and deploys the application to the staging environment. Likewise for the `master` branch and production.

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
