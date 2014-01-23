#!/usr/bin/env bash

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
