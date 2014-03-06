#!/usr/bin/env bash

set -e

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
