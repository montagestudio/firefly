#!/bin/bash

# Runs the given npm command on all directories in services/ that have a package.json
# $1: Command

for service in $(ls -d services/*); do
    if [ -f "$service/package.json" ]; then
        npm "$1" --prefix "$service"
        if [ "$?" -ne 0 ]; then
            exit 1
        fi
    fi
done
