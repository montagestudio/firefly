#!/bin/bash

# Builds the docker image for every directory that has a Dockerfile

for service in $(ls -d ./*); do
    if [ -f "$service/Dockerfile" ]; then
        scripts/build-service-image.sh $(basename "$service")
        if [ "$?" -ne 0 ]; then
            exit 1
        fi
    fi
done
