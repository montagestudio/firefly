#!/usr/bin/env bash

set -e

pushd /srv

if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    mv filament app
    chown -R montage:montage app
    rm -rf filament.tgz
    # We need to token file at the rooot to respond to the haproxy requests
    echo "<html></html>" > index.html
    chown -R montage:montage index.html
fi

popd
