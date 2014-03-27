#!/usr/bin/env bash

set -e

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
