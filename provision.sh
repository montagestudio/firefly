#!/usr/bin/env bash

export IP_ADDRESS=`ifconfig eth0 | grep "inet addr" | awk -F: '{print $2}' | awk '{print $1}'`
export NODE_ENV="production"
export FIREFLY_PORT="2440"
export FIREFLY_APP_URL="http://staging-firefly.declarativ.net"
# export FIREFLY_PROJECT_URL="http://staging-project.declarativ.net"
export FIREFLY_PROJECT_URL="http://project.$IP_ADDRESS.xip.io"

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
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $FIREFLY_PORT

# Create the clone directory
mkdir -p /srv/clone
chown montage:montage /srv/clone
chown montage:montage /srv

# Launch Firefly

# These steps need to be run manually.
# 1. Run `vagrant ssh`
# 2. Copy and paste the environment variables from the top of this file
# 3. Run the 3 commands below

# cd /srv/firefly
# forever stopall
# forever start -a -l /srv/forever.log -o /srv/out.log -e /srv/err.log index.js --client="../filament"

echo
echo "Done"
echo
