#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Setup the build enviroment
${HOME}/deploy/build/setup.sh

# Build the base image
# Not needed for the moment as each image runs the base steps itself
# ${HOME}/deploy/build/base-image.sh

# Build the Load Balancer Image
#${HOME}/deploy/build/load-balancer-image.sh

# Buid Firefly Application Image
${HOME}/deploy/build/firefly-image.sh
