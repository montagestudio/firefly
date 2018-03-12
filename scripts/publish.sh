#!/bin/bash

# Uploads the firefly and filament source to all DigitalOcean droplets.

set -e

DEPLOY_DIR=".deploy"

version=
production=

function usage {
    echo ""
    echo "$0 [-p] -v version"
    echo "        -v version tag to pull firefly and filament from"
    echo "        -p (publish files to the production droplets instead of staging)"
    echo ""
    exit 1
}

while getopts ":v:p" opt; do
    case $opt in
        p)
            production=1
            ;;
        v)
            version="$OPTARG"
            ;;
        *)
            echo "Invalid option: -$OPTARG" >&2
            usage
            exit 1
    esac
done

if [[ -z "$version" ]]; then
    usage
    exit 1
fi

machine_base_name=
if [[ -z "${production}" ]]; then
    machine_base_name="firefly-staging"
else
    machine_base_name="firefly"
fi

if [[ -e "$DEPLOY_DIR" ]]; then
    rm -rf "$DEPLOY_DIR"
fi
mkdir "$DEPLOY_DIR"
pushd "$DEPLOY_DIR"
    git clone --single-branch -b "v$version" git@github.com:montagestudio/firefly
    pushd firefly
        npm install
    popd
    bsdtar --disable-copyfile -czf "firefly.tgz" "firefly"

    git clone --single-branch -b "v$version" git@github.com:montagestudio/filament
    pushd filament
        npm install
        pushd node_modules/montage
            npm install
        popd
    popd
    bsdtar --disable-copyfile -czf "filament.tgz" "filament"

    for i in 1 2 3; do
        echo "Uploading to machine $i"
        machine_name="$machine_base_name-$i"
        docker-machine scp firefly.tgz $machine_name:/tmp/
        docker-machine ssh $machine_name "tar -xzf /tmp/firefly.tgz -C /"
        docker-machine scp filament.tgz $machine_name:/tmp/
        docker-machine ssh $machine_name "tar -xzf /tmp/filament.tgz -C /"
    done
popd
rm -rf "$DEPLOY_DIR"
