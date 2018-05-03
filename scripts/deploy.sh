#!/bin/bash

set -e

SSH_OPTIONS="-o IdentitiesOnly=yes -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
STAGING_MANAGER_IP="159.89.176.34"

# Push tags, staging/prod will pull these tags before starting
docker-compose push

# Create an archive of firefly to upload to environments
tar -cp --exclude='**/node_modules' --exclude=node_modules --exclude='.git' -f firefly.tar.gz .

if [ "$1" == "-p" ]; then
    exit 1
else
    scp ${SSH_OPTIONS} "firefly.tar.gz" "root@${STAGING_MANAGER_IP}:/firefly.tar.gz"
    ssh ${SSH_OPTIONS} "root@${STAGING_MANAGER_IP}" "cd /opt/app && tar -xpf /firefly.tar.gz"
    ssh ${SSH_OPTIONS} "root@${STAGING_MANAGER_IP}" 'cd /opt/app/ && \ 
                                                     export $(cat env/staging.env) && \
                                                     docker-compose pull && \
                                                     docker pull registry.montage.studio/firefly/project:latest && \
                                                     docker-compose -f docker-compose.yml -f docker-compose.production.yml up -p firefly -d --no-build'
fi

rm firefly.tar.gz
