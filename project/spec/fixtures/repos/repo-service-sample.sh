#!/bin/bash

# setup a sample repo with couple test branches

set -e

dest=$1
tempRepo="tempServiceRepo"
sampleRepo="sampleRepo"

# make sure we have a valid destination
if [ "$dest" != "" ]; then
    if [ ! -e $dest ]; then
        mkdir $dest
    fi
    cd $dest

    # create a temporary git repo
    mkdir $tempRepo
    cd $tempRepo
    git init

    # configure git properly to avoid annoying warnings
    git config user.name "jasmine"
    git config user.email jasmine@example.com

    # we need to commit at least one file to have a valid ref
    echo "Are you really one of those guys who reads readme file?" > readme.txt
    git add readme.txt
    git commit -m "initial commit"

    # create a shadow branch for user jasmine
    git branch montagestudio/jasmine/master

    # create an a branch
    git branch experimental

    # now make it a bare git repo to serve are our origin repo
    cd ..
    git clone --bare $tempRepo $sampleRepo.git
    rm -Rf $tempRepo

    # create a clone repo
    git clone $sampleRepo.git $sampleRepo

    echo "$dest/$sampleRepo"
else
	echo "Missing destination argument! You must provide a destination path." 1>&2
	exit 1
fi

exit 0