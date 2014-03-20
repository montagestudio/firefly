#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

source "${HOME}/deploy/build/get.sh"

get-release-number
export BUILD_REVISION_NUMBER=$((${LAST_BUILD_NUMER}+1))
export TAG_NAME="$BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"

echo "Tagging repository for deployment of Release $BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"

if [[ -n ${TAG_NAME} ]]; then
    tag firefly ${TAG_NAME} ${FIREFLY_COMMIT}
    tag filament ${TAG_NAME} ${FILAMENT_COMMIT}

    if [[ -z ${FIREFLY_COMMIT} ]]; then
        export FIREFLY_COMMIT=${TAG_NAME}
    fi

    if [[ -z ${FILAMENT_COMMIT} ]]; then
        export FILAMENT_COMMIT=${TAG_NAME}
    fi
fi

