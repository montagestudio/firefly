#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

# Setup the build enviroment
${HOME}/deploy/build/setup.sh

# Build the base image
${HOME}/deploy/build/base-image.sh

# Build the Load Balancer Image
${HOME}/deploy/build/load-balancer-image.sh

# Buid Login Application Image
${HOME}/deploy/build/login-image.sh

# Buid Project Application Image
${HOME}/deploy/build/project-image.sh
