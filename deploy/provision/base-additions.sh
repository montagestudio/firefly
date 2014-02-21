#!/usr/bin/env bash

# Git
apt-get install -y git

# To save time lets load the new repositories first
# For Node
add-apt-repository --yes ppa:chris-lea/node.js
# For Redis
add-apt-repository --yes ppa:rwky/redis
# And be sure we are up to date
apt-get update

# Node
apt-get install --yes nodejs

# Run with naught for zero-downtime deploys
npm install -g naught

# Redis
apt-get install --yes redis-server
# npm install -g redis
# npm install -g hiredis redis
