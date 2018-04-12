#!/bin/bash

user_stacks=$(docker stack ls | grep 'firefly-project_')
if [ ! -z "${user_stacks}" ]; then
    echo "${user_stacks}" | awk '{print $1}' | xargs docker stack rm
fi
