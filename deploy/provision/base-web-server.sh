#!/usr/bin/env bash

set -e

# Add nginx
add-apt-repository -y ppa:nginx/stable

apt-get update --fix-missing

# Download nginx
apt-get --yes install nginx --install-suggests
