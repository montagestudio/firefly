#!/bin/bash

scripts/rm-project-services.sh
git rev-parse HEAD > common/GIT_HASH
docker stack deploy --compose-file docker-compose.yml firefly
