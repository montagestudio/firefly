#!/usr/bin/env bash

HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Make sure we are at the root of the project
export HOME=`echo ${HOME} | sed s_/deploy__`

source ${HOME}/deploy/env.sh

# Setup the build enviroment
./setup.sh

# Build the base image
./buildbaseimage.sh

# Build the Load Balancer Image
./buildloadbalancerimage.sh

# Buid Login Application Image
./buildloginimage.sh

# Buid Project Application Image
./buildprojectimage.sh
