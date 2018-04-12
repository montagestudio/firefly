#!/bin/bash

set -e

stack_name="$1"

docker stack rm ${stack_name}

# Docker stack rm doesn't exit cleanly, networks get left behind for several seconds,
# prevents deploying the stack again. This tries to run "docker stack rm" until the
# command exits cleanly, at which point the stack is ready to be deployed again.
function check_cleaned {
    # $1: # of consecutive attempts

    set +e
    docker stack rm ${stack_name} &> /dev/null

    if [ ! $? -eq 0 ]; then
        set -e
        if [ $1 -gt 15 ]; then
            printf "\nWaited too long for Docker to clean up, giving up.\n"
            exec docker stack rm ${stack_name}
        else
            printf "."
            sleep 2
            check_cleaned $(($1 + 1))
        fi
    fi
}

printf "Waiting for docker to clean up gracefully..."
check_cleaned 1
printf "\n"
