#!/bin/bash

user_containers=$(docker container ls | grep 'firefly-project_')
if [ ! -z "${user_containers}" ]; then
    echo "${user_containers}" | awk '{print $1}' | xargs docker container rm -f
fi
