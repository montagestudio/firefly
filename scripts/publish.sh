#!/bin/bash

# Uploads the firefly and filament source to all DigitalOcean droplets.

DEPLOY_DIR=".deploy"

version=
production=

usage ()
{
    echo ""
    echo "$0 [-:vp] -v version"
    echo "        -p (publish files to the production droplets instead of staging)"
    echo "        -v version tag to pull firefly and filament from"
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
        \?)
            echo "Invalid option: -$OPTARG" >&2
            usage;
            exit 1
    esac
done

machine_base_name=
if [[ -z "${production}" ]]; then
    machine_base_name="firefly-staging-"
else
    machine_base_name="firefly-"

mkdir "$DEPLOY_DIR"
pushd "$DEPLOY_DIR"
    git clone --single-branch -b "$version" git@github.com:montagestudio/firefly
    pushd firefly
        npm install
    popd
    bsdtar --disable-copyfile -czf "firefly.tgz" "firefly"

    git clone --single-branch -b "$version" git@github.com:montagestudio/filament
    pushd filament
        npm install
    popd
    bsdtar --disable-copyfile -czf "filament.tgz" "filament"

    for i in 1 2 3; do
        echo "Uploading to machine $i"
        docker-machine scp firefly.tgz "firefly$i":/tmp/
        docker-machine ssh "$machine_base_name-$i" "tar -xzf /tmp/firefly.tgz /srv/"
        docker-machine scp filament.tgz "firefly$i":/tmp/
        docker-machine ssh "$machine_base_name-$i" "tar -xzf /tmp/filament.tgz /srv/"
    done
popd
rm -rf "$DEPLOY_DIR"
