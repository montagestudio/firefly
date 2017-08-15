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
pushd ${BUILD}
    if [[ -e "firefly" ]]; then
        if [[ -e "filament" ]]; then
            cp -R "firefly/inject/adaptor" "filament/."

            # Configure Rollbar logging
            if [[ -e "filament/track.js" ]]; then
                sed -i.bak 's/var ENVIRONMENT = .*;/var ENVIRONMENT = "production";/' "filament/track.js"
                if [[ -e "filament/GIT_HASH" ]]; then
                    GIT_HASH=`cat filament/GIT_HASH`
                    sed -i.bak "s/var GIT_HASH = .*;/var GIT_HASH = \"$GIT_HASH\";/" "filament/track.js"
                fi
            fi

            bsdtar --disable-copyfile -czf "filament.tgz" "filament"
        fi
    fi
popd

build-base-image "base-web-server-image"
export BASE_IMAGE_ID=`get-image-id "base-web-server-image-$BUILD_RELEASE_NAME"`

remove-image "web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER"

echo "***** Building web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER *****"

packer build \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER" \
    "${HOME}/deploy/web-server-image.json"

# Remove the previous build
declare PREVIOUS_BUILD_REVISION_NUMBER=$((${BUILD_REVISION_NUMBER}-1))
remove-image "web-server-image-$BUILD_RELEASE_NAME-$PREVIOUS_BUILD_REVISION_NUMBER"

get-clean filament
get-clean firefly
