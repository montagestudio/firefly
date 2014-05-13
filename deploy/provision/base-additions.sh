#!/usr/bin/env bash

set -e

apt-get update --fix-missing
# Git
apt-get install --yes git

# To save time lets load the new repositories first
# For Node
add-apt-repository --yes ppa:chris-lea/node.js
# For Redis
add-apt-repository --yes ppa:rwky/redis
# And be sure we are up to date
apt-get update --fix-missing

# Node
apt-get install --yes nodejs

# Run with naught for zero-downtime deploys
npm install -g naught
