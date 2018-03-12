#!/bin/bash

# Tags a release on both the filament and firefly repositories.
# $1: Version number to use

function usage {
    echo ""
    echo "Usage: $0 version_number"
    echo "Example: $0 21.3.1"
    echo ""
}

# Adapted from timseverien/bump
function bump {
    search='("version":[[:space:]]*").+(")'
    replace="\1$2\2"
    sed -i.bak -E "s/${search}/${replace}/" "$1"
    rm "$1.bak"
}

if [[ "$#" -ne 1 ]]; then
    usage
    exit 1
fi

if [ ! -z "$(git status --porcelain)" ]; then
    echo "Firefly has uncommitted changes"
    exit 1
fi
pushd ../filament
    if [ ! -z "$(git status --porcelain)" ]; then
        echo "Filament has uncommitted changes"
        exit 1
    fi
popd

bump package.json "$1"
git commit package.json -m "Bump version v$1"
git tag "v$1"
git push --tags

pushd ../filament
    bump package.json "$1"
    git commit package.json -m "Bump version v$1"
    git tag "v$1"
    git push --tags
popd

echo "Tag v$1 created"
