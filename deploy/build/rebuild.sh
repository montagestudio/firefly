#!/usr/bin/env bash

set -e

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

COMMAND_PATH="$0"
usage() {
    echo ""
    echo "${COMMAND_PATH} [-p] [-n <build number>] [-r <build revision>] ";
    echo "     -p production"
    echo "     -n build revision number"
    echo "     -r build release name"
    echo ""
    exit 1;
}

export PRODUCTION="FALSE"
while getopts ":pn:r:" opt; do
    case $opt in
        p)
            export PRODUCTION="TRUE"
            ;;
        n)
            export BUILD_REVISION_NUMBER="$OPTARG"
            ;;
        r)
            export BUILD_RELEASE_NAME="$OPTARG"
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

source "${HOME}/deploy/build/get.sh"

get-release-number

export FIREFLY_SSH_OPTIONS="-o IdentitiesOnly=yes -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

get_ip () {
    # The argument is teh droplet name
    echo `tugboat info -n $1  | grep "IP" | sed 's/IP:[ ]*\([0-9\.]*\)/\1/'`
}

get_status () {
    # The argument is teh droplet name
    echo `tugboat info -n $1 | grep "Status" | sed 's/Status:[ ]*\([a-z]*\)/\1/'`
}

get_ssh_status () {
    # The argument is teh droplet IP address
    echo `ssh -q -o "BatchMode=yes" $FIREFLY_SSH_OPTIONS "montage@$1" "echo 2>&1" && echo "Up" || echo "Down"`
}

wait_for_droplet ()
{
    # This should be as simple as using the buildin tugboat feature but it does not appears to work all teh time.
    # tugboat wait -n $1
    # We need to wait for the droplets to come back alive after rebuild
    declare DROPLET_STATUS=$(get_status $1)
    if [[ "$DROPLET_STATUS" != "[32mactive[0m" ]]; then
        echo "$1 is [$DROPLET_STATUS] waiting."
        tugboat wait -n $1
        DROPLET_STATUS=$(get_status $1)
        echo "$1 is [$DROPLET_STATUS]."
        # We need to wait for the service to come on line
        IP=$(get_ip $1)
        declare SSH_STATUS=$(get_ssh_status $IP)
        if [[ "$SSH_STATUS" != "Up" ]]; then
            echo -n "SSH connection for $1 is down waiting"
            while [[ "$SSH_STATUS" != "Up" ]]; do
                echo -n "."
                sleep 5
                SSH_STATUS=$(get_ssh_status $IP)
            done
            echo ""
        fi
    fi
}

ROLLBAR_LOCAL_USERNAME=$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER
rollbar() {
    # $1 environment
    # $2 machine name
    # $3 project (firefly or filament)
    # $4 rollbar access code

    # We need to wait for the droplets to come back alive after rebuild
    wait_for_droplet $2
    ROLLBAR_ENVIRONMENT=$1
    ROLLBAR_REVISION=`tugboat ssh -n $2 -q -c "cat /srv/$3/GIT_HASH" | tail -n 1`
    if [[ -z $ROLLBAR_REVISION ]]; then
        # Sometimes it does not work the first time so try again
        ROLLBAR_REVISION=`tugboat ssh -n $2 -q -c "cat /srv/$3/GIT_HASH" | tail -n 1`
    fi

    if [[ -n $ROLLBAR_REVISION ]]; then
         curl https://api.rollbar.com/api/1/deploy/ \
          -F access_token=$4 \
          -F environment=$ROLLBAR_ENVIRONMENT \
          -F revision=$ROLLBAR_REVISION \
          -F local_username=$ROLLBAR_LOCAL_USERNAME
         echo ""
    fi
    echo "Registered $3 $1 deploy $ROLLBAR_REVISION with Rollbar"
}

staging ()
{
    # We need to wait for the droplets to come back alive after rebuild
    wait_for_droplet $1
    
    echo "Uploading script to $1"
    IP=$(get_ip $1)
    scp $FIREFLY_SSH_OPTIONS "${HOME}/deploy/build/staging.sh" "montage@${IP}:/srv"
    # Execute the staging script on the droplet
    echo "Executing script to $1"
    tugboat ssh -n $1 -c 'sudo chmod +x /srv/staging.sh; sudo /srv/staging.sh'
}

if [[ $PRODUCTION == "TRUE" ]]; then
    tugboat rebuild -n LoadBalancer -m load-balancer-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n WebServer -m web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Login1 -m login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Login2 -m login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Project1 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Project2 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Project3 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n Project4 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c

    rollbar "production" "Login1" "filament" "457750e5906f47199de4c5b51d78a141"
    rollbar "production" "Login1" "firefly" "afa2e8f334974bc58b0415fd06a02b40"
else
    tugboat rebuild -n StagingLoadBalancer -m load-balancer-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n StagingWebServer -m web-server-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n StagingLogin1 -m login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n StagingLogin2 -m login-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n StagingProject1 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c
    tugboat rebuild -n StagingProject2 -m project-image-$BUILD_RELEASE_NAME-$BUILD_REVISION_NUMBER -c

    staging StagingLoadBalancer
    staging StagingWebServer
    staging StagingLogin1
    staging StagingLogin2
    staging StagingProject1
    staging StagingProject2
    
    rollbar "staging" "StagingLogin1" "filament" "457750e5906f47199de4c5b51d78a141"
    rollbar "staging" "StagingLogin1" "firefly" "afa2e8f334974bc58b0415fd06a02b40"
fi
