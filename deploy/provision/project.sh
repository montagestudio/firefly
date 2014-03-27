#!/usr/bin/env bash

set -e

# Unpack filament and firefly
pushd /srv
if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    chown -R montage:montage filament
fi
if [[ -e "/srv/firefly.tgz" ]]; then
    tar -xzf firefly.tgz
    chown -R montage:montage firefly
fi
popd

#Create the container image
pushd /srv
	docker build -t firefly_project --rm .
popd
