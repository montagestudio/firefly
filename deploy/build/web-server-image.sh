#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

source "${HOME}/deploy/build/get.sh"

get filament $FILAMENT_COMMIT
get firefly $FIREFLY_COMMIT

# Lets do a bit of cleanup
pushd ${BUILD}
    if [[ -e "firefly" ]]; then
        if [[ -e "filament" ]]; then
            cp -R "firefly/inject/adaptor" "filament/."
            tar -czf "filament.tgz" "filament"
        fi
    fi
popd

declare IMAGE_EXIST=`tugboat info_image "webserverimage-$BUILD_NUMBER" | grep Name`
if [[ -n ${IMAGE_EXIST} ]]; then
	tugboat destroy_image "webserverimage-$BUILD_NUMBER" -c
fi

${BUILD}/packerio/packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "snapshot_name=webserverimage-$BUILD_NUMBER" \
    ${HOME}/deploy/web-server-image.json

get-clean filament
get-clean firefly
