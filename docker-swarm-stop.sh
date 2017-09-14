#!/bin/bash

# Shutdown
docker stack rm firefly
docker service rm docker-registry
docker swarm leave --force