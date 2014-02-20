#!/bin/sh

# Remove existing containers
vagrant ssh project -c 'sudo su -c "docker ps -a -q | xargs --no-run-if-empty docker stop | xargs --no-run-if-empty docker rm && rm -f /srv/container-index.json"'
