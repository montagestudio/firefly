#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

get-release-number

get filament ${FILAMENT_COMMIT}
get firefly ${FIREFLY_COMMIT}

# Lets do a bit of cleanup
pushd "${BUILD}"
    if [[ -e "firefly" ]]; then
        rm -rf "firefly/deploy"
        tar --disable-copyfile -czf "firefly.tgz" "firefly"
    fi
popd

build-base-image "base-project-image"
export BASE_IMAGE_ID=`get-image-id "base-project-image-$BUILD_RELEASE_NAME"`

remove-image "project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER"

echo "***** Building project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER *****"

packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER" \
    "${HOME}/deploy/project-image.json"

# Remove the previous build
declare PREVIOUS_BUILD_REVISION_NUMBER=$((${BUILD_REVISION_NUMBER}-1))
remove-image "project-image-$BUILD_RELEASE_NAME-$PREVIOUS_BUILD_REVISION_NUMBER"

get-clean filament
get-clean firefly
