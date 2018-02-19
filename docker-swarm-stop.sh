#!/bin/bash

# Shutdown
docker stack rm firefly

# Sometimes swarm networks don't get cleaned up properly, prune them
docker-machine ssh firefly1 "docker network prune -f"
docker-machine ssh firefly2 "docker network prune -f"
docker-machine ssh firefly3 "docker network prune -f"
