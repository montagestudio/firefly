#!/usr/bin/env bash

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

gem install tugboat --install-dir ${GEM_HOME}
# gem install system_timer --install-dir ${GEM_HOME}

# Install packer io
if [[ -d ${BUILD}/packerio ]]; then
	rm -rf ${BUILD}/packerio
fi
mkdir ${BUILD}/packerio

curl -LO https://dl.bintray.com/mitchellh/packer/0.5.1_darwin_amd64.zip

unzip 0.5.1_darwin_amd64.zip -d ${BUILD}/packerio

rm -rf 0.5.1_darwin_amd64.zip

popd
