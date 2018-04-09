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
        ./node_modules/.bin/merge-yaml -i firefly-stack.yml firefly-stack.dev.yml -o .firefly-stack.yml
    else
        ./node_modules/.bin/merge-yaml -i firefly-stack.yml firefly-stack.prod.yml -o .firefly-stack.yml
    fi
    docker stack deploy --compose-file .firefly-stack.yml firefly
    rm .firefly-stack.yml
)
