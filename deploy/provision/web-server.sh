#!/usr/bin/env bash

# Download HAProxy
apt-get --yes install nginx --install-suggests

pushd /srv

if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    pushd filament
      npm rebuild
    popd
	mv filament app
    chown -R montage:montage app
	rm -rf filament.tgz
fi

popd
