#!/usr/bin/env bash

# Download HAProxy
apt-get --yes install nginx --install-suggests

pushd /srv

if [[ -e "/srv/filament.tgz" ]]; then
	tar -xzf filament.tgz
	pushd filament
	  npm rebuild
	popd
	chown -R montage:montage filament
fi

popd