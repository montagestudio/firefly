#!/bin/sh

# Rebuild container
vagrant ssh project -c 'sudo docker build -f /srv/firefly/Dockerfile -t firefly_project -rm /srv'
