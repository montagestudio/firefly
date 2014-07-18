#!/usr/bin/env bash

HOME="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )"

# Root is 2 directories up from here
HOME=$(dirname -- "${HOME}")
export HOME=$(dirname -- "${HOME}")

export BUILD="${HOME}/.deploy"

export GEM_HOME="${BUILD}/digitalocean"
export GEM_PATH="${GEM_HOME}/gems:/Library/Ruby/Gems/2.0.0"
export GEM_CACHE="${BUILD}/digitalocean/cache"

export PATH="${PATH}:${BUILD}/digitalocean/bin:${BUILD}/packerio"

if [[ -z $DEFAULTS_HAVE_BEEN_SET ]]; then

    # BUILD_RELEASE_NAME is used to define the root tag for the build
    # BUILD_REVISION_NUMBER is used to define the root tag for the build
    # The tag name will be $BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER
    #
    if [[ -z $BUILD_RELEASE_NAME ]]; then
        # To simplify manual build this should be set to the current release cycle
        export BUILD_RELEASE_NAME="kerry"
    fi

    if [[ -z $BUILD_REVISION_NUMBER  ]]; then
        export BUILD_REVISION_NUMBER=1
    fi

    export LAST_BUILD_NUMER=-1

    export TAG_REPOSITORIES="TRUE"

    export DEFAULTS_HAVE_BEEN_SET="TRUE"

fi

