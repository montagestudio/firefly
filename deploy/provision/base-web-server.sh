#!/usr/bin/env bash

set -e

apt-get update --fix-missing
# Download HAProxy
apt-get --yes install nginx --install-suggests
