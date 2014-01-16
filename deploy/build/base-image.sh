#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

${BUILD}/packerio/packer build \
    -var "do_api_key=3b6311afca5bd8aac647b316704e9c6d" \
    -var "do_client_id=383c8164d4bdd95d8b1bfbf4f540d754" \
    -var "snapshot_name=baseimage-$BUILD_NUMBER" \
    ${HOME}/deploy/base-image.json
