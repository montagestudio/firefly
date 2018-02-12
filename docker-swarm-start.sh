#!/bin/bash

print_status()
{
    # $1: status
    echo -e "\033[32m$1\033[0m"
}

# Init Swarm
print_status "Initializing swarm"
INIT_CODE=
if [ -z "$IP" ]; then
    docker swarm init
else
    docker swarm init --advertise-addr "$IP"
fi
INIT_CODE=$?
if [ $INIT_CODE -ne 0 ]; then
    echo "Initializing swarm failed. You may need to specify an advertise addr by setting an IP environment variable"
    exit $INIT_CODE
fi

SWARM_TOKEN=$(docker swarm join-token -q worker)
SWARM_MASTER=$(docker info --format "{{.Swarm.NodeAddr}}")

echo "Swarm master IP: $SWARM_MASTER"

# Create docker swarm registry
print_status "Creating swarm registry"
docker service create --name docker-registry --publish 5000:5000 --detach=true \
    registry:2

# Start services to check docker-compose.yml
print_status "Checking docker-compose.yml"
docker-compose rm
docker-compose up -d --build

# Stop services 
docker-compose down --volumes
docker-compose stop

# Build container image
print_status "Building project image"
docker build -t firefly_project -f ./project/Dockerfile .

# Push to docker swarm registry
print_status "Pushing to docker swarm registry"
# docker-compose push

print_status "Deploying swarm"
docker stack deploy --compose-file docker-compose.yml firefly
docker stack services firefly
