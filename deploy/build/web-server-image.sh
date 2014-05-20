#!/usr/bin/env bash -x

source "$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

source "${HOME}/deploy/build/get.sh"

#get-release-number # exports LAST_BUILD_NUMBER BUILD_REVISION_NUMBER
#check-refs # exports FILAMENT_COMMIT and FIREFLY_COMMIT

#get filament ${FILAMENT_COMMIT}
#get firefly ${FIREFLY_COMMIT}

FIREFLY_COMMIT="$(cd -- "${FIREFLY_PATH}"; git rev-parse HEAD)"
FILAMENT_COMMIT="$(cd -- "${FILAMENT_PATH}"; git rev-parse HEAD)"

FIREFLY_PATH="$(dirname -- "$(dirname "${HERE}")")"
FILAMENT_PATH="$(dirname -- "${FIREFLY_PATH}")/filament"
FILAMENT_OVERLAY_PATH="${BUILD}/filament-overlay"
FILAMENT_BUILDS_PATH="${BUILD}/filament-builds"
FILAMENT_ARCHIVE="${BUILD}/filament.tgz"

# default
#MOP="$FILAMENT_PATH/node_modules/.bin/mop"
# debug
#MOP="node $FIREFLY_PATH/../mop/optimize.js -o 0"
# XXX stopgap debug
MOP="node ${HOME}/deploy/build/fakemop.js"

# Capture a snapshot of Filament in an intermediate location
rm -rf "${FILAMENT_OVERLAY_PATH}"
mkdir -p -- "$FILAMENT_OVERLAY_PATH"
(
    cd -- "$FILAMENT_PATH";
    git archive "HEAD"
) \
| (
    cd -- "${FILAMENT_OVERLAY_PATH}";
    tar xf -
) || exit -1

# Overlay the Firefly adaptor for Filament on the intermediate files
mkdir -p -- "${FILAMENT_OVERLAY_PATH}/adaptor"
(
    cd -- "${FILAMENT_PATH}";
    # extract only the "inject/adaptor" directory from Firefly.
    git archive HEAD inject/adaptor
) \
| (
    cd -- "${FILAMENT_OVERLAY_PATH}";
    tar --strip=1 -xf -
    # --strip=1 removes the "inject" prefix from each of the archived files.
) || exit -1

# Configure Rollbar logging
TRACK_PATH="${FILAMENT_OVERLAY_PATH}/track.js"
if [[ -e "${TRACK_PATH}" ]]; then
    sed -i.bak 's/var ENVIRONMENT = .*;/var ENVIRONMENT = "production";/' "${TRACK_PATH}"
    sed -i.bak "s/var GIT_HASH = .*;/var GIT_HASH = \"$FILAMENT_COMMIT\";/" "${TRACK_PATH}"
fi

# Mop the combined Filament overlays
(
    cd -- "$FILAMENT_OVERLAY_PATH";
    $MOP -t "$FILAMENT_BUILDS_PATH"
) || exit -1

# Archive it for deployment
(
    cd -- "${FILAMENT_BUILDS_PATH}/filament";
    find . -print0 \
        | xargs -0 tar --disable-copyfile -czf "$FILAMENT_ARCHIVE"
        # --disable-copyfile is a little-known, hard to find directive that
        # tells tar not to use the underlying copyfile C lib function, which
        # causes Mac OS extended attributes (formerly resource forks) as "._"
        # prefixed files in tar archives. These usually get round tripped to OS
        # X file systems, but are just trash elsewhere.
) || exit -1

build-base-image "base-web-server-image"
export BASE_IMAGE_ID=`get-image-id "base-web-server-image-$BUILD_RELEASE_NAME"`

remove-image "web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER"

echo "***** Building web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER *****"

packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "base_image_id=$BASE_IMAGE_ID" \
    -var "snapshot_name=web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER" \
    "${HOME}/deploy/web-server-image.json"

# Remove the previous build
declare PREVIOUS_BUILD_REVISION_NUMBER=$((${BUILD_REVISION_NUMBER}-1))
remove-image "web-server-image-$BUILD_RELEASE_NAME-$PREVIOUS_BUILD_REVISION_NUMBER"

get-clean filament
get-clean firefly

