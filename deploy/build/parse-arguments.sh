#!/usr/bin/env bash

# Used exclusively by images.sh

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

COMMAND_PATH="$0"

usage() {
    echo ""
    echo "${COMMAND_PATH} [-b <branch>] [-c <branch>] [-n <build number>] [-r <build revision>] [-f] [-t]";
    echo "     -b filament branch"
    echo "     -c firefly branch"
    echo "     -f (force base image rebuild)"
    echo "     -n build revision number"
    echo "     -r build release name"
    echo "     -t (do not tag repositories)"
    echo "     -x (debug mode)"
    echo ""
    exit 1;
}

while getopts ":b:c:fn:r:tx" opt; do
    case $opt in
        b)
            export FILAMENT_COMMIT="$OPTARG"
            ;;
        c)
            export FIREFLY_COMMIT="$OPTARG"
            ;;
        f)
            export FORCE_BASE_IMAGE_REBUILD="TRUE"
            ;;
        n)
            export BUILD_REVISION_NUMBER="$OPTARG"
            ;;
        r)
            export BUILD_RELEASE_NAME="$OPTARG"
            ;;
        t)
            export TAG_REPOSITORIES="FALSE"
            ;;
        x)
            set -x
            ;;
       \?)
            echo "Invalid option: -$OPTARG" >&2
            usage;
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument." >&2
            usage;
            exit 1
            ;;
    esac
done

# This should be a parameter
export REGION_ID=4

if [[ -z $TAG_NAME ]]; then
    export TAG_NAME="$BUILD_RELEASE_NAME/$BUILD_REVISION_NUMBER"
fi
