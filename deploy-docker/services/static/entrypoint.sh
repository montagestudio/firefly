#!/bin/bash

echo "Starting nginx..."
nginx || nginx -s reload

NGINX_EXIT_CODE=$?

if [ "$NGINX_EXIT_CODE" -eq 0 ]; then
    echo -e "\033[032mStarted\033[0m"
else
    echo -e "\033[031mNginx exited with code $NGINX_EXIT_CODE\033[0m"
    exit $NGINX_EXIT_CODE
fi

# Keeps the process running so the container doesn't exit. While we're at it,
# we show nginx's error log.
tail -f /var/log/nginx/filament.error.log