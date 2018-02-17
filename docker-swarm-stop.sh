#!/bin/bash

# Shutdown
docker stack rm firefly
docker service rm docker-registry

docker-machine ssh firefly1 "docker network prune -f"
docker-machine ssh firefly2 "docker network prune -f"
docker-machine ssh firefly3 "docker network prune -f"
