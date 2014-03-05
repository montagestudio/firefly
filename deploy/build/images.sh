#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Setup the build enviroment
"${HOME}/deploy/build/setup.sh"

# Parse the arguments list and setup the environment
source "${HOME}/deploy/build/parse-arguments.sh" "$@"

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

if [[ $SKIP_BASE_IMAGE != "TRUE" ]]; then
    # Build the base image
    time "${HOME}/deploy/build/base-image.sh"
fi

# Build the Load Balancer Image
time "${HOME}/deploy/build/load-balancer-image.sh"

# Buid Firefly Filament Web Server Image
time "${HOME}/deploy/build/web-server-image.sh"

# Buid Firefly Login Application Image
time "${HOME}/deploy/build/login-image.sh"

# Buid Firefly Project Application Image
time "${HOME}/deploy/build/project-image.sh"
