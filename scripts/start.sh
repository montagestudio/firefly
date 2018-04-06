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

    if [ "$NODE_ENV" == "development" ]; then
        ./node_modules/.bin/merge-yaml -i docker-compose.yml docker-compose.dev.yml -o .docker-compose.dev.yml
        docker stack deploy --compose-file .docker-compose.dev.yml firefly
        rm .docker-compose.dev.yml
    else
        docker stack deploy firefly
    fi
)
