#!/usr/bin/env bash

# set -xe
set -xe

HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Root is 2 directories up from here
export HOME="$(dirname $(dirname ${HOME}))"

export BUILD=${HOME}/.deploy

export GEM_HOME=${BUILD}/digitalocean
export GEM_PATH=${GEM_HOME}/gems:/Library/Ruby/Gems/2.0.0
export GEM_CACHE=${BUILD}/digitalocean/cache

export PATH=${PATH}:${BUILD}/digitalocean/bin:${BUILD}/packerio
