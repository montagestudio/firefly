#!/bin/bash

scripts/rm-project-services.sh

docker stack deploy --compose-file docker-compose.yml firefly
