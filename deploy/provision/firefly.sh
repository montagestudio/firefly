#!/usr/bin/env bash

set -e

# Port 80 to Firefly port
export FIREFLY_PORT="2440"
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $FIREFLY_PORT

cd /srv

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
