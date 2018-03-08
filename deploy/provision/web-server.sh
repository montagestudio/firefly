#!/usr/bin/env bash

set -e

pushd /srv
if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    export BASE_DIR="app"
    export TARGET_DIR="$BASE_DIR"
    if [[ -e "filament/GIT_HASH" ]]; then
        export GIT_HASH=`cat filament/GIT_HASH`
        export TARGET_DIR="$BASE_DIR/$GIT_HASH"
    fi
    mkdir -p "$TARGET_DIR"
    mv -f filament/* "$TARGET_DIR"
    pushd "$TARGET_DIR"
        find . -iname '*.css' | while read -r file ; do
            sed -i.bak 's?url(/assets/?url(/app/'$GIT_HASH'/assets/?' "$file"
        done
    popd
    chown -R montage:montage "$TARGET_DIR"
    rm -rf filament.tgz
    # We need to token file at the rooot to respond to the haproxy requests
    echo "<html></html>" > index.html
    chown -R montage:montage index.html
fi
popd
