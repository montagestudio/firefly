#!/bin/bash

# Wait a few seconds to give other containers enough time to start their servers
sleep 5s

service rsyslog restart
service haproxy start && service haproxy reload

HAPROXY_EXIT_CODE=$?

if [ "$HAPROXY_EXIT_CODE" -eq 0 ]; then
    echo -e "\033[032mStarted\033[0m"
else
    echo -e "\033[031mHaproxy exited with code $HAPROXY_EXIT_CODE\033[0m"
    exit $HAPROXY_EXIT_CODE
fi

# Keeps the process running so the container doesn't exit. While we're at it we
# show the haproxy log.
tail -f /var/log/haproxy_0.log
