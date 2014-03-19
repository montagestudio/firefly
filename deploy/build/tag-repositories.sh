#!/usr/bin/env bash


# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

if [[ -n ${BUILD_RELEASE_NAME} ]]; then
    TAG_EXIST=`git tag -l "${BUILD_RELEASE_NAME}/*"`
    if [[ -n ${TAG_EXIST} ]]; then
        LAST_BUILD=`git tag -l "${BUILD_RELEASE_NAME}/*" | sed s/[^/]*\\/// | sort -n | tail -n 1`
        export BUILD_REVISION_NUMBER=$((${LAST_BUILD}+1))
    else
        export BUILD_REVISION_NUMBER=1
    fi
    export TAG_NAME="$BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"
fi

echo "Tagging repository for deployment of Release $BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"

if [[ -n ${TAG_NAME} ]]; then
    source "${HOME}/deploy/build/get.sh"

    tag filament ${TAG_NAME} ${FILAMENT_COMMIT}
    tag firefly ${TAG_NAME} ${FIREFLY_COMMIT}

    if [[ -z ${FILAMENT_COMMIT} ]]; then
        export FILAMENT_COMMIT=${TAG_NAME}
    fi

    if [[ -z ${FIREFLY_COMMIT} ]]; then
        export FIREFLY_COMMIT=${TAG_NAME}
    fi
fi

