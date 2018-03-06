#!/bin/sh

for m in $(docker-machine ls -q); do
    if echo "$m" | grep -q firefly; then
        docker-machine ssh "$m" "docker container ls -q | xargs docker container restart"
    fi
done
