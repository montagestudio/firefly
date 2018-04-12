#!/bin/bash

set -e

stack_name="$1"

if [ -z "$NODE_ENV" ]; then
    export NODE_ENV="development"
fi

# Load appropriate env file
export $(sed '/^#/d' "env/${NODE_ENV}.env")

stack_yml=${stack_name}-stack.yml

if [ "$NODE_ENV" == development ]; then
    dev_stack_yml="$1"-stack.dev.yml
    merged_stack_yml="$1"-stack.merged.yml
    ./node_modules/.bin/merge-yaml -i ${stack_yml} ${dev_stack_yml} -o ${merged_stack_yml} > /dev/null
    docker stack deploy --compose-file ${merged_stack_yml} ${stack_name}
    rm ${merged_stack_yml}
else
    docker stack deploy --compose-file ${stack_yml} ${stack_name}
fi
