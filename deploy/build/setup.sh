#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

pushd "${HOME}"

if [[ ! -d "${BUILD}" ]]; then
    mkdir "${BUILD}"
fi

# Install tugboat for digitalocean
pushd "${BUILD}"
    if [[ -d digitalocean ]]; then
        rm -rf digitalocean
    fi
    mkdir digitalocean
popd

# We need a local install of tugboat as we want to have the rebuild command
# This has been merged and published so we don't need this until the next time
# gem install ${HOME}/deploy/files/tugboat-0.0.10.gem --install-dir ${GEM_HOME}
gem install tugboat --install-dir "${GEM_HOME}"
# gem install system_timer --install-dir ${GEM_HOME}

# Install packer io
pushd "${BUILD}"
    if [[ -d packerio ]]; then
        rm -rf packerio
    fi
    mkdir packerio

    KERNELNAME=$(uname -s| tr '[:upper:]' '[:lower:]')

    PACKER="0.5.2_${KERNELNAME}_amd64.zip"
    curl -LO "https://dl.bintray.com/mitchellh/packer/${PACKER}"
    unzip ${PACKER} -d packerio
    rm -rf ${PACKER}
popd

popd

# Ensure tugboat is correctly configured
tugboat verify
if [ "$?" != "0" ]; then
  echo "Unable to connect to digital ocean. Please check your tugboat config is correct and referenced by TUGBOAT_CONFIG_PATH environment variable."
  exit 255
fi
