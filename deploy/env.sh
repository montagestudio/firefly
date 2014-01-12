#!/usr/bin/env bash

HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Make sure we are at the root of the project
export HOME=`echo ${HOME} | sed s_/deploy__`

export BUILD=${HOME}/build

export GEM_HOME=${BUILD}/digitalocean
export GEM_PATH=${GEM_HOME}/gems:/Library/Ruby/Gems/2.0.0
export GEM_CACHE=${BUILD}/digitalocean/cache

export PATH=${PATH}:${BUILD}/digitalocean/bin:${BUILD}/packerio
