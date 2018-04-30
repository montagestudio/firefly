#!/bin/bash

set -e

SSH_OPTIONS="-o IdentitiesOnly=yes -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
STAGING_MANAGER_IP="159.89.176.34"

docker-compose -f firefly-stack.yml push

if [ "$1" == "-p" ]; then
    exit 1
else
    scp ${SSH_OPTIONS} "traefik-stack.yml" "root@${STAGING_MANAGER_IP}:/opt/app/traefik-stack.yml"
    scp ${SSH_OPTIONS} "firefly-stack.yml" "root@${STAGING_MANAGER_IP}:/opt/app/firefly-stack.yml"
    scp ${SSH_OPTIONS} "env/staging.env"   "root@${STAGING_MANAGER_IP}:/opt/app/.env"
    scp ${SSH_OPTIONS} "traefik/traefik.toml"      "root@${STAGING_MANAGER_IP}:/opt/app/traefik/traefik.toml"
    ssh ${SSH_OPTIONS} "root@${STAGING_MANAGER_IP}" 'cd /opt/app &&\
                                 export $(cat ".env") &&\
                                 docker stack deploy -c traefik-stack.yml traefik &&\
                                 docker stack deploy -c firefly-stack.yml firefly'
fi
