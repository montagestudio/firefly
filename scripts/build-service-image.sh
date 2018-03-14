#!/bin/sh
# $1: Image/service name

docker build -t firefly_"$1" -f ./"$1"/Dockerfile .
docker tag firefly_"$1" 127.0.0.1:5000/"$1"
docker push 127.0.0.1:5000/"$1"
