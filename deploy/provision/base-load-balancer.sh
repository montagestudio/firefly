#!/usr/bin/env bash

set -e

add-apt-repository --yes ppa:vbernat/haproxy-1.5
apt-get update --fix-missing
# Download HAProxy
apt-get --yes install haproxy=1.5*

# Make sure that HAProxy starts after Networking
# PJYF [Jan 18 2014] Not sure this is required keep it there in case we have issue when restating
# sudo update-rc.d -f haproxy remove
# sudo update-rc.d -f networking remove
# sudo update-rc.d haproxy start 37 2 3 4 5 . stop 20 0 1 6 .
# sudo update-rc.d networking start 34 2 3 4 5 .

# Set the startup script
rm /etc/default/haproxy
echo "# Set ENABLED to 1 if you want the init script to start haproxy." > /etc/default/haproxy
echo "ENABLED=1" >> /etc/default/haproxy
echo "# Add extra flags here." >> /etc/default/haproxy
echo "#EXTRAOPTS=\"-de -m 16\"" >> /etc/default/haproxy

# Redis
apt-get install --yes redis-server
# Prevent redis starting on startup
update-rc.d redis-server disable
