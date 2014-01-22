#!/usr/bin/env bash

# Install Docker
curl -sL https://get.docker.io/ | sh

# Unpack filament and firefly
pushd /srv
if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    pushd filament
      npm rebuild
    popd
    chown -R montage:montage filament
fi
if [[ -e "/srv/firefly.tgz" ]]; then
    tar -xzf firefly.tgz
    pushd firefly
      npm rebuild
    popd
    chown -R montage:montage firefly
fi
popd

#Create the container image
pushd /srv
	docker build -t firefly_project -rm .
popd

# Install the project server to start the containers
pushd /srv
if [[ -e "/srv/projectserver.tgz" ]]; then
    tar -xzf projectserver.tgz
    pushd projectserver
      npm rebuild
    popd
    chown -R montage:montage projectserver
fi
popd

# export FIREFLY_PORT="2440"
# iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $FIREFLY_PORT







