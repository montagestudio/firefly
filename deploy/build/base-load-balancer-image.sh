#!/usr/bin/env bash

source "$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and set up the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

get-release-number
check-refs

build-base-image "base-image"
export BASE_IMAGE_ID=`get-image-id "base-image-$BUILD_RELEASE_NAME"`

remove-image "base-load-balancer-image-$BUILD_RELEASE_NAME"

echo "***** Building base-load-balancer-image-$BUILD_RELEASE_NAME *****"

packer build \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=base-load-balancer-image-$BUILD_RELEASE_NAME" \
    "${HOME}/deploy/base-load-balancer-image.json"

