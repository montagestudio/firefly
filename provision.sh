#!/usr/bin/env bash

export FIREFLY_APP_HOST="app.162.243.148.146.xip.io"
export FIREFLY_APP_PORT=2440

export FIREFLY_PROJECT_HOST="project.162.243.148.146.xip.io"
export FIREFLY_PROJECT_PORT=2440

# Curl
apt-get install -y curl

# Git
apt-get install -y git

# Node
apt-get update
apt-get install -y python-software-properties python g++ make software-properties-common
add-apt-repository ppa:chris-lea/node.js
apt-get update
apt-get install -y nodejs

# Run with forever to restart the server if it crashes
npm install -g forever

# Port 80 to Firefly port
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $FIREFLY_APP_PORT

# Create the clone directory
mkdir -p /srv/clone
chown montage:montage /srv/clone
chown montage:montage /srv
