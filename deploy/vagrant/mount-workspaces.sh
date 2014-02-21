#!/bin/sh

# Stop containers
vagrant ssh project -c 'sudo su -c "docker ps -a -q | xargs --no-run-if-empty docker stop"'
# Stop real project server and start server with mounted workspaces
vagrant ssh project -c 'sudo stop firefly-project; cd /srv/firefly && sudo node /srv/firefly/project.js --client=/srv/filament --mount-workspaces'
