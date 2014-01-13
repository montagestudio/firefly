#!/usr/bin/env bash

# Curl
apt-get install -y curl

# Git
apt-get install -y git

# Node
apt-get update
apt-get install --yes python-software-properties python g++ make software-properties-common
add-apt-repository --yes ppa:chris-lea/node.js
apt-get update
apt-get install --yes nodejs

# Run with naught for zero-downtime deploys
npm install -g naught

# Create the montage user that the server will run under
adduser --disabled-password --gecos "" montage
mkdir -p /home/montage/.ssh
# cp $HOME/.ssh/authorized_keys /home/montage/.ssh
chown -R montage:montage /home/montage/.ssh/

# Create the clone directory
mkdir -p /srv
chown -R montage:montage /srv
