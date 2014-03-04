#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

COMMAND_PATH="$0"
usage() {
    echo ""
    echo "${COMMAND_PATH} [-p] [-n <build number>] ";
    echo "     -p production"
    echo "     -n build number"
    echo ""
    exit 1;
}

ROLLBAR_ACCESS_TOKEN=afa2e8f334974bc58b0415fd06a02b40
ROLLBAR_LOCAL_USERNAME=`whoami`
rollbar() {
    ROLLBAR_ENVIRONMENT=$1
    ROLLBAR_REVISION=`tugboat ssh -n $2 -c "cat /srv/firefly/GIT_HASH" | tail -n 1`

    echo curl https://api.rollbar.com/api/1/deploy/ \
      -F access_token=$ROLLBAR_ACCESS_TOKEN \
      -F environment=$ROLLBAR_ENVIRONMENT \
      -F revision=$ROLLBAR_REVISION \
      -F local_username=$ROLLBAR_LOCAL_USERNAME
}

export PRODUCTION="FALSE"
while getopts ":p:n" opt; do
    case $opt in
        p)
            export PRODUCTION="TRUE"
            ;;
        n)
            export BUILD_NUMBER="$OPTARG"
            ;;
        \?)
            usage;
            exit 1
            ;;
        :)
            usage;
            exit 1
            ;;
    esac
done

staging ()
{
    # We need to wait for the droplets to come back alive after rebuild
    declare DROPLET_STATUS=`tugboat info -n $1 | grep "Status" | sed 's/Status:[ ]*\([a-z]*\)/\1/'`
    if [[ "$DROPLET_STATUS" != "[32mactive[0m" ]]; then
        echo -n "$1 not active [$DROPLET_STATUS] waiting."
        while [[ "$DROPLET_STATUS" != "[32mactive[0m" ]]; do
            echo -n "."
            sleep 5
            DROPLET_STATUS=`tugboat info -n $1 | grep "Status" | sed 's/Status:[ ]*\([a-z]*\)/\1/'`
        done
        echo ""
    fi
    # Execute the staging script on the droplet
    tugboat ssh -n $1 -c 'bash -s' < ${HOME}/deploy/build/staging.sh
}

if [[ $PRODUCTION == "TRUE" ]]; then
    tugboat rebuild -n LoadBalancer -m loadbalancerimage-$BUILD_NUMBER -c
    tugboat rebuild -n WebServer -m webserverimage-$BUILD_NUMBER -c
    tugboat rebuild -n Login1 -m loginimage-$BUILD_NUMBER -c
    tugboat rebuild -n Login2 -m loginimage-$BUILD_NUMBER -c
    tugboat rebuild -n Project1 -m projectimage-$BUILD_NUMBER -c
    tugboat rebuild -n Project2 -m projectimage-$BUILD_NUMBER -c
    tugboat rebuild -n Project3 -m projectimage-$BUILD_NUMBER -c
    tugboat rebuild -n Project4 -m projectimage-$BUILD_NUMBER -c
    
    rollbar "production" "Login1"
else
    tugboat rebuild -n StagingLoadBalancer -m loadbalancerimage-$BUILD_NUMBER -c
    tugboat rebuild -n StagingWebServer -m webserverimage-$BUILD_NUMBER -c
    tugboat rebuild -n StagingLogin1 -m loginimage-$BUILD_NUMBER -c
    tugboat rebuild -n StagingLogin2 -m loginimage-$BUILD_NUMBER -c
    tugboat rebuild -n StagingProject1 -m projectimage-$BUILD_NUMBER -c
    tugboat rebuild -n StagingProject2 -m projectimage-$BUILD_NUMBER -c
    
    staging StagingLoadBalancer
    staging StagingWebServer
    staging StagingLogin1
    staging StagingLogin2
    staging StagingProject1
    staging StagingProject2
    
    rollbar "staging" "StagingLogin1"
fi
