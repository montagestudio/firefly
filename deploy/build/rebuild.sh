#!/usr/bin/env bash

source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/env.sh"

COMMAND_PATH="$0"
usage() {
    echo ""
    echo "${COMMAND_PATH} [-p] ";
    echo "     -p production"
    echo ""
    exit 1;
}

export PRODUCTION="FALSE"
while getopts ":p" opt; do
    case $opt in
        p)
            export PRODUCTION="TRUE"
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

if [[ $PRODUCTION == "TRUE" ]]; then
    tugboat rebuild LoadBalancer loadbalancerimage-$BUILD_NUMBER -c
    tugboat rebuild WebServer webserverimage-$BUILD_NUMBER -c
    tugboat rebuild Login1 loginimage-$BUILD_NUMBER -c
    tugboat rebuild Login2 loginimage-$BUILD_NUMBER -c
    tugboat rebuild Project1 projectimage-$BUILD_NUMBER -c
    tugboat rebuild Project2 projectimage-$BUILD_NUMBER -c
    tugboat rebuild Project3 projectimage-$BUILD_NUMBER -c
    tugboat rebuild Project4 projectimage-$BUILD_NUMBER -c

    ROLLBAR_ENVIRONMENT=production
else
    tugboat rebuild StagingLoadBalancer loadbalancerimage-$BUILD_NUMBER -c
    tugboat rebuild StagingWebServer webserverimage-$BUILD_NUMBER -c
    tugboat rebuild StagingLogin1 loginimage-$BUILD_NUMBER -c
    tugboat rebuild StagingLogin2 loginimage-$BUILD_NUMBER -c
    tugboat rebuild StagingProject1 projectimage-$BUILD_NUMBER -c
    tugboat rebuild StagingProject2 projectimage-$BUILD_NUMBER -c

    ROLLBAR_ENVIRONMENT=staging
fi

ROLLBAR_ACCESS_TOKEN=afa2e8f334974bc58b0415fd06a02b40
ROLLBAR_LOCAL_USERNAME=`whoami`
ROLLBAR_REVISION=`git rev-parse HEAD`

curl https://api.rollbar.com/api/1/deploy/ \
  -F access_token=$ROLLBAR_ACCESS_TOKEN \
  -F environment=$ROLLBAR_ENVIRONMENT \
  -F revision=$ROLLBAR_REVISION \
  -F local_username=$ROLLBAR_LOCAL_USERNAME
