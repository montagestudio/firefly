#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Setup the build enviroment
${HOME}/deploy/build/setup.sh

# Parse the arguments list and setup the environment
source ${HOME}/deploy/build/parse-arguments.sh "$@"

# Build the base image
# Not needed for the moment as each image runs the base steps itself
# ${HOME}/deploy/build/base-image.sh

# Build the Load Balancer Image
${HOME}/deploy/build/load-balancer-image.sh

# Buid Firefly Filament Web Server Image
${HOME}/deploy/build/web-server-image.sh

# Buid Firefly Login Application Image
${HOME}/deploy/build/login-image.sh

# Buid Firefly Project Application Image
${HOME}/deploy/build/project-image.sh
