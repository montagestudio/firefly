#!/usr/bin/env bash

# To see the debug log add the x option to the folloing line: set -xe
set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

COMMAND_PATH="$0"

usage() {
    echo ""
    echo "${COMMAND_PATH} [-b <branch>] [-c <branch>] [-n <build number>] [-s] [-t <tag name>]";
    echo "     -b filament branch"
    echo "     -c firefly branch"
    echo "     -n build number"
    echo "     -s (skip base image build)"
    echo "     -t tag the repositories"
    echo ""
    exit 1;
}

while getopts ":b:c:n:t:s" opt; do
    case $opt in
        b)
            export FILAMENT_COMMIT="$OPTARG"
            ;;
        c)
            export FIREFLY_COMMIT="$OPTARG"
            ;;
        n)
            export BUILD_NUMBER="$OPTARG"
            ;;
        s)
            export SKIP_BASE_IMAGE="TRUE"
            ;;
        t)
            export TAG_NAME="$OPTARG"
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
