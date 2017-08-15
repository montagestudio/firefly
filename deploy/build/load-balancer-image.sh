#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

get-release-number
check-refs

build-base-image "base-load-balancer-image"
export BASE_IMAGE_ID=`get-image-id "base-load-balancer-image-$BUILD_RELEASE_NAME"`

remove-image "load-balancer-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER"

echo "***** Building load-balancer-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER *****"

packer build \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=load-balancer-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER" \
    "${HOME}/deploy/load-balancer-image.json"

# Remove the previous build
declare PREVIOUS_BUILD_REVISION_NUMBER=$((${BUILD_REVISION_NUMBER}-1))
remove-image "load-balancer-image-$BUILD_RELEASE_NAME-$PREVIOUS_BUILD_REVISION_NUMBER"
