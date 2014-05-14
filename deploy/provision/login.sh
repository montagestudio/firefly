#!/usr/bin/env bash

set -e

pushd /srv

if [[ -e "/srv/filament.tgz" ]]; then
    tar -xzf filament.tgz
    pushd filament
        # Change the index to account for the hash key
        if [[ -e GIT_HASH ]]; then
    	    export GIT_HASH=`cat GIT_HASH`
            sed -i.bak 's?<base href="/app/">?<base href="/app/'$GIT_HASH'/">?' firefly-index.html
            sed -i.bak 's?data-package="/app"?data-package="/app/'$GIT_HASH'"?' firefly-index.html
            sed -i.bak 's?<base href="/app/login/">?<base href="/app/'$GIT_HASH'/login/">?' login/index.html
            sed -i.bak 's?data-package="/app"?data-package="/app/'$GIT_HASH'"?' login/index.html
            sed -i.bak 's?/assets/videos?/app/'$GIT_HASH'/assets/videos?' login/index.html
            sed -i.bak 's?<base href="/app/project-list/">?<base href="/app/'$GIT_HASH'/project-list/">?' project-list/index.html
            sed -i.bak 's?data-package="/app"?data-package="/app/'$GIT_HASH'"?' project-list/index.html
        fi
    popd
    chown -R montage:montage filament
fi
if [[ -e "/srv/firefly.tgz" ]]; then
    tar -xzf firefly.tgz
    chown -R montage:montage firefly
fi

popd

# Redis-sentinel config file needs to be writable by redis as it stores state there
chown redis:redis /etc/redis/redis-sentinel.conf
