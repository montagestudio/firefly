#!/bin/bash

# Runs npm test on all directories in services/ that have a package.json

for service in $(ls -d services/*); do
    if [ -f "$service/package.json" ]; then
        npm test --prefix "$service"
        if [ "$?" -ne 0 ]; then
            exit 1
        fi
    fi
done
