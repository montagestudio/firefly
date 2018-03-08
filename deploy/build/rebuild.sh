#!/usr/bin/env bash

# Resets either the staging (default) or production (-p) dropplets with new set
# of built images. Each of the droplets in the selected working set will be shut
# down, the corresponding image will be written over their file system, and they
# will be rebooted.
# The build number and revision come from TODO

set -e

source "$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

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
    echo `tugboat info -n $1  | grep "IP" | sed 's/IP4:[ ]*\([0-9\.]*\)/\1/'`
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
    fi

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

tugboat_scp ()
{
    # $1: Droplet name
    # $2: Source
    # $3: Destination

    # We need to wait for the droplets to come back alive after rebuild
    wait_for_droplet $1
    
    echo "Uploading $2 to $1"
    IP=$(get_ip $1)
    scp $FIREFLY_SSH_OPTIONS "$2" "montage@${IP}:$3"
}

staging ()
{
    tugboat_scp $1 "${HOME}/deploy/build/staging.sh" "/srv"
    # Execute the staging script on the droplet
    echo "Executing script to $1"
    tugboat ssh -n $1 -c 'sudo chmod +x /srv/staging.sh; sudo /srv/staging.sh'
}

lets_encrypt ()
{
    # $1: Droplet name (Load Balancer)
    # $2: Main domain
    # $3: Project domain
    # $4: Contact email

    wait_for_droplet $1

    tugboat_scp $1 "${HOME}/deploy/build/lets-encrypt.sh" "/srv"
    echo "Executing script to $1"
    tugboat ssh -n $1 -c "sudo chmod +x /srv/lets-encrypt.sh; sudo /srv/lets-encrypt.sh $2 $3 $4"
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

    # To generate a certificate on deploy (careful with LetsEncrypt usage limits):
    lets_encrypt LoadBalancer work.montagestudio.com project.montagestudio.net corentin.debost@kaazing.com

    # Or, to copy the certificate in the repository without generating a new one:
    # tugboat_scp LoadBalancer "${HOME}/deploy/files/work.montagestudio.com.pem" "/srv"
    # tugboat ssh -n LoadBalancer -c "sudo mkdir -p /etc/haproxy/certs && sudo mv /srv/work.montagestudio.com.pem /etc/haproxy/certs/"
    # tugboat ssh -n LoadBalancer -c "sudo service haproxy reload"

    rollbar "production" "Login1" "filament" "dccb9acdbffd4c8bbd21247e51a0619e"
    rollbar "production" "Login1" "firefly" "80c8078968bf4f9a92aee1af74e46b57"
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

    rollbar "staging" "StagingLogin1" "filament" "dccb9acdbffd4c8bbd21247e51a0619e"
    rollbar "staging" "StagingLogin1" "firefly" "80c8078968bf4f9a92aee1af74e46b57"

    # To generate a certificate on deploy (careful with LetsEncrypt usage limits):
    lets_encrypt StagingLoadBalancer staging-aurora.montagestudio.com staging-project.montagestudio.net corentin.debost@kaazing.com

    # Or, to copy the certificate in the repository without generating a new one:
    # tugboat_scp StagingLoadBalancer "${HOME}/deploy/files/staging-aurora.montagestudio.com.pem" "/srv"
    # tugboat ssh -n StagingLoadBalancer -c "sudo mkdir -p /etc/haproxy/certs && sudo mv /srv/staging-aurora.montagestudio.com.pem /etc/haproxy/certs/"
    # tugboat ssh -n StagingLoadBalancer -c "sudo service haproxy reload"
fi
