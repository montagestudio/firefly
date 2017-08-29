#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

get-release-number
check-refs

get filament ${FILAMENT_COMMIT}
get firefly ${FIREFLY_COMMIT}

# Lets do a bit of cleanup
pushd "${BUILD}"
    if [[ -e "firefly" ]]; then
        cp "firefly/deploy/files/production.env" "firefly/.env"
        cp "firefly/deploy/files/staging.env" "firefly/staging.env"
        rm -rf "firefly/deploy"
        bsdtar --disable-copyfile -czf "firefly.tgz" "firefly"
    fi
popd

build-base-image "base-login-image"
export BASE_IMAGE_ID=`get-image-id "base-login-image-$BUILD_RELEASE_NAME"`

remove-image "login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER"

echo "***** Building login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER *****"

packer build \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER" \
    "${HOME}/deploy/login-image.json"

# Remove the previous build
declare PREVIOUS_BUILD_REVISION_NUMBER=$((${BUILD_REVISION_NUMBER}-1))
remove-image "login-image-$BUILD_RELEASE_NAME-$PREVIOUS_BUILD_REVISION_NUMBER"

get-clean filament
get-clean firefly
