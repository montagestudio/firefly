#!/usr/bin/env bash

export HAPROXY="haproxy-1.4.24-pcre-40kses-linux-i586.stripped"

# Download HAProxy
apt-get install haproxy

# Set the startup script
rm /etc/default/haproxy
echo "# Set ENABLED to 1 if you want the init script to start haproxy." > /etc/default/haproxy
echo "ENABLED=1" >> /etc/default/haproxy
echo "# Add extra flags here." >> /etc/default/haproxy
echo "#EXTRAOPTS=\"-de -m 16\"" >> /etc/default/haproxy


