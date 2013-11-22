#!/usr/bin/env bash

export IP_ADDRESS=`ifconfig eth0 | grep "inet addr" | awk -F: '{print $2}' | awk '{print $1}'`
export NODE_ENV="semiproduction"
export FIREFLY_APP_PORT=2440
export FIREFLY_APP_HOST="app.$IP_ADDRESS.xip.io"
export FIREFLY_PROJECT_HOST="project.$IP_ADDRESS.xip.io"

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

# Launch Firefly

cd /srv/firefly
# Just in case we're rerunning this provisioner
sudo -u montage forever stopall
sudo -u montage forever start -a -l /srv/forever.log -o /srv/out.log -e /srv/err.log index.js --client="../filament"

echo
echo "Done"
echo
