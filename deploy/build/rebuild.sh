#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

tugboat rebuild LoadBalancer loadbalancerimage-$BUILD_NUMBER -c
tugboat rebuild WebServer webserverimage-$BUILD_NUMBER -c
tugboat rebuild Login1 loginimage-$BUILD_NUMBER -c
tugboat rebuild Login2 loginimage-$BUILD_NUMBER -c
tugboat rebuild Project1 projectimage-$BUILD_NUMBER -c
tugboat rebuild Project2 projectimage-$BUILD_NUMBER -c
tugboat rebuild Project3 projectimage-$BUILD_NUMBER -c
tugboat rebuild Project4 projectimage-$BUILD_NUMBER -c