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

# Build images in docker-compose.yml
print_status "Building stack images from docker-compose.yml"
docker-compose rm
docker-compose up -d --build
docker-compose down --volumes
docker-compose stop

# Build container image
print_status "Building project image"
docker build -t firefly_project -f ./project/Dockerfile .
docker tag firefly_project 127.0.0.1:5000/project

# Push images to docker swarm registry
print_status "Pushing to docker swarm registry"
docker-compose push
docker push 127.0.0.1:5000/project

# Deploy swarm
print_status "Deploying swarm"
docker stack deploy --compose-file docker-compose.yml firefly
docker stack services firefly
