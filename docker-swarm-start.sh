#!/bin/bash

print_status()
{
    # $1: status
    echo -e "\033[32m$1\033[0m"
}

# Init Swarm
print_status "Initializing swarm"
docker swarm init --advertise-addr 192.168.0.63
SWARM_TOKEN=$(docker swarm join-token -q worker)
SWARM_MASTER=$(docker info --format "{{.Swarm.NodeAddr}}")

echo "Swarm master IP: $SWARM_MASTER"

# Create docker swarm registry
print_status "Creating swarm registry"
docker service create --name docker-registry --publish 5000:5000 --detach=true \
    registry:2

# Start visualizer to visualize Docker Swarm and Services Status
# Visit http://localhost:5001/
print_status "Creating swarm visualizer at localhost:5001"
docker run -it -d --name swarm-visualizer \
    -p 5001:8080 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    dockersamples/visualizer

# Start services to check docker-compose.yml
print_status "Checking docker-compose.yml"
docker-compose rm
docker-compose up -d --build

# Stop services 
docker-compose down --volumes
docker-compose stop

# Push to docker swarm registry
print_status "Pushing to docker swarm registry"
# docker-compose push

print_status "Deploying swarm"
docker stack deploy --compose-file docker-compose.yml firefly
docker stack services firefly
