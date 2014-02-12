#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

source "${HOME}/deploy/build/get.sh"

get filament $FILAMENT_COMMIT
get firefly $FIREFLY_COMMIT

declare IMAGE_EXIST=`tugboat info_image "fireflyimage-$BUILD_NUMBER" | grep Name`
if [[ -n ${IMAGE_EXIST} ]]; then
	tugboat destroy_image "fireflyimage-$BUILD_NUMBER" -c
fi

${BUILD}/packerio/packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "snapshot_name=fireflyimage-$BUILD_NUMBER" \
    ${HOME}/deploy/firefly-image.json

get-clean filament
get-clean firefly
