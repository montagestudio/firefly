#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

source "${HOME}/deploy/build/get.sh"

get filament $FILAMENT_COMMIT
get firefly $FIREFLY_COMMIT

# Lets do a bit of cleanup
pushd ${BUILD}
    if [[ -e "firefly" ]]; then
        rm -rf "firefly/deploy"
        tar -czf "firefly.tgz" "firefly"
    fi
popd

# Package the project server
pushd ${BUILD}
	cp -R "${HOME}/projectserver" "projectserver"
	tar -czf "projectserver.tgz" "projectserver"
popd


${BUILD}/packerio/packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "snapshot_name=projectimage-$BUILD_NUMBER" \
    ${HOME}/deploy/project-image.json

get-clean filament
get-clean firefly
rm -rf "${BUILD}/projectserver"
