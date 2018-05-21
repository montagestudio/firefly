#!/bin/bash

# setup a bare repo and make 2 clone of it

set -e

dest=$1
tempRepo="tempServiceRepo"
bareRepo="originServiceRepo"

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
    cd ..

    # now make it a bare git repo to serve are our origin repo
    git clone --bare $tempRepo $bareRepo
    rm -Rf $tempRepo

    # make two clones of it
    git clone $bareRepo serviceRepo1
    git clone $bareRepo serviceRepo2
else
	echo "Missing destination argument! You must provide a destination path." 1>&2
	exit 1
fi

exit 0