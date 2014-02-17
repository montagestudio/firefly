#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

pushd ${HOME}

if [[ ! -d ${BUILD} ]]; then
    mkdir ${BUILD}
fi

# Install tugboat for digitalocean
if [[ -d ${BUILD}/digitalocean ]]; then
    rm -rf ${BUILD}/digitalocean
fi
mkdir ${BUILD}/digitalocean

# We need a local install of tugboat as we want to have the rebuild command
# This has been merged and published so we don't need this until the next time
# gem install ${HOME}/deploy/files/tugboat-0.0.10.gem --install-dir ${GEM_HOME}
gem install tugboat --install-dir ${GEM_HOME}
# gem install system_timer --install-dir ${GEM_HOME}

# Install packer io
if [[ -d ${BUILD}/packerio ]]; then
    rm -rf ${BUILD}/packerio
fi
mkdir ${BUILD}/packerio

PACKER="0.5.1_darwin_amd64.zip"
curl -LO https://dl.bintray.com/mitchellh/packer/${PACKER}
unzip ${PACKER} -d ${BUILD}/packerio
rm -rf ${PACKER}

popd
