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
adduser --disabled-password --gecos "" admin
adduser admin sudo
mkdir -p /home/admin/.ssh
if [[ -e "/tmp/authorized_keys" ]]; then
    cp /tmp/authorized_keys /home/admin/.ssh/authorized_keys
fi
chown -R admin:admin /home/admin/.ssh/

# Create the montage user that the server will run under
adduser --disabled-password --gecos "" montage
mkdir -p /home/montage/.ssh
if [[ -e "/tmp/authorized_keys" ]]; then
    cp /tmp/authorized_keys /home/montage/.ssh/authorized_keys
fi
chown -R montage:montage /home/montage/.ssh/

rm -rf /tmp/authorized_keys

# Verify the permissions on the sudoers file
if [[ -e "/etc/sudoers.d/sudoers" ]]; then
    chmod 0440 "/etc/sudoers.d/sudoers"
fi

# Create the clone directory
mkdir -p /srv
chown -R montage:montage /srv
