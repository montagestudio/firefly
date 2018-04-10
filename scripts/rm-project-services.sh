#!/bin/bash

PROJECT_SERVICES=$(docker service ls | grep 'project:')
if [ ! -z "${PROJECT_SERVICES}" ]; then
    echo "${PROJECT_SERVICES}" | awk '{print $1}' | xargs docker service rm
fi
