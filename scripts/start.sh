#!/bin/bash

scripts/rm-project-services.sh
git rev-parse HEAD > common/GIT_HASH

(
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV="development"
    fi

    # Load appropriate env file
    export $(sed '/^#/d' "env/${NODE_ENV}.env")

    # Used for creating volumes to firefly on new project services in development
    export WORKING_DIR=$(pwd) 

    docker stack deploy --compose-file "${SWARM_YML}" firefly
)
