#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

packer build \
    -only virtualbox-iso \
    -var "do_api_key=" \
    -var "do_client_id=" \
    -var "snapshot_name=" \
    "${HOME}/deploy/base-image.json"
