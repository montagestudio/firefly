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
    pushd firefly
        # Change the extensions service to account for the hash key
        if [[ -e "/srv/filament/GIT_HASH" ]]; then
            export GIT_HASH=`cat "/srv/filament/GIT_HASH"`
            sed -i.bak 's@/app/extensions@/app/'$GIT_HASH'/extensions@' container/services/extension-service.js
        fi
    popd
    chown -R montage:montage firefly
fi
popd

#Create the container image
pushd /srv
	docker build -t firefly_project --rm .
popd
