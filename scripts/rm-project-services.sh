#!/bin/bash

PROJECT_SERVICES=$(docker service ls | grep '/project ')
if [ ! -z "${PROJECT_SERVICES}" ]; then
    awk '{print $1}' "${PROJECT_SERVICES}" | xargs docker service rm
fi
