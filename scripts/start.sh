#!/bin/bash

scripts/rm-project-services.sh
git rev-parse HEAD > common/GIT_HASH

# docker stack deploy does not currently read .env files
(
    export $(sed '/^#/d' .env)
    docker stack deploy --compose-file docker-compose.yml firefly
)
