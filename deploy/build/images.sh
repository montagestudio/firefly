#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Setup the build enviroment
"${HOME}/deploy/build/setup.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

"${HOME}/deploy/build/tag-repositories.sh"

if [[ $FORCE_BASE_IMAGE_REBUILD == "TRUE" ]]; then
    # Build the base image
    time "${HOME}/deploy/build/base-image.sh"
    # Build the base image
    time "${HOME}/deploy/build/base-load-balancer-image.sh"
    # Build the base image
    time "${HOME}/deploy/build/base-web-server-image.sh"
    # Build the base image
    time "${HOME}/deploy/build/base-login-image.sh"
    # Build the base image
    time "${HOME}/deploy/build/base-project-image.sh"
fi

# Build the Load Balancer Image
time "${HOME}/deploy/build/load-balancer-image.sh"

# Buid Firefly Filament Web Server Image
time "${HOME}/deploy/build/web-server-image.sh"

# Buid Firefly Login Application Image
time "${HOME}/deploy/build/login-image.sh"

# Buid Firefly Project Application Image
time "${HOME}/deploy/build/project-image.sh"
