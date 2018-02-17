#!/bin/bash

print_status()
{
    # $1: status
    echo -e "\033[32m$1\033[0m"
}

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
docker-compose push

print_status "Deploying swarm"
docker stack deploy --compose-file docker-compose.yml firefly
docker stack services firefly
