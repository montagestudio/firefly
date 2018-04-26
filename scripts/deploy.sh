#!/bin/bash

STAGING_MANAGER_IP="159.89.176.34"

if [ "$1" == "-p" ]; then
    exit 1
else
    scp "traefik-stack.yml" "root@${STAGING_MANAGER_IP}:/opt/app/traefik-stack.yml"
    scp "firefly-stack.yml" "root@${STAGING_MANAGER_IP}:/opt/app/firefly-stack.yml"
    scp "env/staging.env"   "root@${STAGING_MANAGER_IP}:/opt/app/.env"
    scp "traefik/traefik.toml"      "root@${STAGING_MANAGER_IP}:/opt/app/traefik/traefik.toml"
    ssh "root@${STAGING_MANAGER_IP}" 'cd /opt/app &&\
                                 export $(cat ".env") &&\
                                 docker stack deploy -c traefik-stack.yml traefik &&\
                                 docker stack deploy -c firefly-stack.yml firefly'
fi
