#!/usr/bin/env bash

set -e

# Redis-sentinel config file needs to be writable by redis as it stores state there
chown redis:redis /etc/redis/redis-sentinel.conf
