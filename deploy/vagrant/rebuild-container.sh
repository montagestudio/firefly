#!/bin/sh

# Rebuild container
vagrant ssh project -c 'sudo docker build -t firefly_project -rm /srv'
