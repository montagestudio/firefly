#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

get-release-number
check-refs

build-base-image "base-image"
export BASE_IMAGE_ID=`get-image-id "base-image-$BUILD_RELEASE_NAME"`

remove-image "base-login-image-$BUILD_RELEASE_NAME"

echo "***** Building base-login-image-$BUILD_RELEASE_NAME *****"

packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=base-login-image-$BUILD_RELEASE_NAME" \
    "${HOME}/deploy/base-login-image.json"
