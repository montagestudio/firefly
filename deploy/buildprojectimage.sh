#!/usr/bin/env bash

HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Make sure we are at the root of the project
export HOME=`echo ${HOME} | sed s_/deploy__`

source ${HOME}/deploy/env.sh
